/**
 * Export Script — Standard 12, Maths
 *
 * Queries the DB and generates a hierarchical diff-style JSON file:
 *   scripts/standard/12/maths/segregation.json
 *
 * Every node starts with _action: "none" and oldName === newName.
 * You then manually edit the JSON:
 *   - Change _action to "rename" and update newName  → renames the entry
 *   - Add a new node with _action: "add" (no _id)    → creates a new entry
 *
 * Run:
 *   node scripts/standard/12/maths/exportSegregation.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Models ────────────────────────────────────────────────────────────────────

const subjectSchema = new mongoose.Schema({
  name: String,
  standard: Number,
  chapters: [{ type: mongoose.Schema.Types.ObjectId, ref: "Chapter" }],
});

const chapterSchema = new mongoose.Schema({
  name: String,
  subjectName: String,
  standard: Number,
  chapterNumber: { type: Number, default: null },
  topics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }],
  exam: [String],
});

const topicSchema = new mongoose.Schema({
  name: String,
  chapterName: String,
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
  subjectName: String,
  standard: Number,
  topicNumber: { type: Number, default: null },
  subtopics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subtopic" }],
  exam: [String],
});

const subtopicSchema = new mongoose.Schema({
  name: String,
  topicName: String,
  chapterName: String,
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
  subjectName: String,
  standard: Number,
  subtopics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subtopic" }],
});

const Subject  = mongoose.model("Subject",  subjectSchema);
const Chapter  = mongoose.model("Chapter",  chapterSchema);
const Topic    = mongoose.model("Topic",    topicSchema);
const Subtopic = mongoose.model("Subtopic", subtopicSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively resolve nested subtopics (Subtopic.subtopics is self-referential) */
async function resolveSubtopics(subtopicIds) {
  if (!subtopicIds || subtopicIds.length === 0) return [];

  const docs = await Subtopic.find({ _id: { $in: subtopicIds } }).lean();

  return Promise.all(
    docs.map(async (sub) => {
      const nestedChildren = await resolveSubtopics(sub.subtopics);
      const node = {
        _id: sub._id.toString(),
        oldName: sub.name,
        newName: sub.name,
        _action: "none",
      };
      if (nestedChildren.length > 0) {
        node.subtopics = nestedChildren;
      }
      return node;
    })
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

async function exportSegregation() {
  const MAIN_DATABASE_URL = process.env.MAIN_DATABASE_URL;
  if (!MAIN_DATABASE_URL) {
    console.error("❌  MAIN_DATABASE_URL is not set in .env");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB…");
  await mongoose.connect(MAIN_DATABASE_URL, { dbName: "leadllyQuestions" });
  console.log("✅  Connected");

  // 1. Find the Maths subject for standard 12
  const subject = await Subject.findOne({
    standard: 12,
    name: { $regex: /^maths$/i },
  }).lean();

  if (!subject) {
    console.error('❌  Subject "Maths" for standard 12 not found.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`📘  Found subject: "${subject.name}" (${subject.chapters.length} chapters)`);

  // 2. Fetch all chapters belonging to this subject
  const chapters = await Chapter.find({ _id: { $in: subject.chapters } })
    .sort({ chapterNumber: 1, name: 1 })
    .lean();

  console.log(`📂  Fetching topics and subtopics for ${chapters.length} chapters…`);

  // 3. Build the full hierarchy
  const chapterNodes = await Promise.all(
    chapters.map(async (chapter) => {
      const topics = await Topic.find({ _id: { $in: chapter.topics } })
        .sort({ topicNumber: 1, name: 1 })
        .lean();

      const topicNodes = await Promise.all(
        topics.map(async (topic) => {
          const subtopicNodes = await resolveSubtopics(topic.subtopics);

          return {
            _id: topic._id.toString(),
            oldName: topic.name,
            newName: topic.name,
            _action: "none",
            ...(subtopicNodes.length > 0 && { subtopics: subtopicNodes }),
          };
        })
      );

      return {
        _id: chapter._id.toString(),
        oldName: chapter.name,
        newName: chapter.name,
        chapterNumber: chapter.chapterNumber,
        _action: "none",
        exam: chapter.exam ?? [],
        ...(topicNodes.length > 0 && { topics: topicNodes }),
      };
    })
  );

  // 4. Assemble the final document
  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      standard: 12,
      subject: subject.name,
      subjectId: subject._id.toString(),
      instructions: [
        "Each node has: _id (DB ObjectId), oldName (current DB value), newName (desired value), _action.",
        "_action values:",
        "  'none'   → no change (still recurse into children)",
        "  'rename' → set newName to the desired name, keep oldName as-is",
        "  'add'    → new entry; omit _id; set newName; add children as needed",
        "Do NOT change _id or oldName — the apply script uses them for lookups.",
      ],
    },
    standard: 12,
    subject: {
      _id: subject._id.toString(),
      oldName: subject.name,
      newName: subject.name,
      _action: "none",
    },
    chapters: chapterNodes,
  };

  // 5. Write to disk
  const outputPath = path.join(__dirname, `${subject.standard}_${subject.name}_segregation.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`\n✅  Done! JSON written to:\n    ${outputPath}`);
  console.log(`    Chapters : ${chapterNodes.length}`);
  console.log(
    `    Topics   : ${chapterNodes.reduce((acc, c) => acc + (c.topics?.length ?? 0), 0)}`
  );
  console.log(
    `    Subtopics: ${chapterNodes.reduce(
      (acc, c) =>
        acc + (c.topics?.reduce((a, t) => a + (t.subtopics?.length ?? 0), 0) ?? 0),
      0
    )}`
  );

  await mongoose.disconnect();
}

exportSegregation().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
