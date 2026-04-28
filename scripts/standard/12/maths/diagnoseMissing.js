/**
 * Diagnose Missing Topics/Subtopics — Standard 12, Maths
 *
 * Connects to MAIN_DATABASE_URL and searches for the specific topics/subtopics
 * reported as missing from exportSegregation output.
 *
 * Run:
 *   node scripts/standard/12/maths/diagnoseMissing.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

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

// ── Reported missing items (chapter → topics/subtopics) ──────────────────────

// Keys are approximate chapter name patterns (case-insensitive regex).
// Values are arrays of topic/subtopic names to search for.
const MISSING = {
  "MATRIX|MATRICES": [
    "cayley - hamilton theorem",
    "cayley hamilton theorem",
    "system of linear equations and rank of matrix",
    "system of linear equations",
    "rank of matrix",
  ],
  "RELATIONS AND FUNCTIONS": [
    "miscellaneous functions",
  ],
  "INVERSE TRIGONOMETRIC": [
    "converting one t function to other t function",
    "t inverse t propert",
    "t inverse t properties",
    "properties of inverse trigonometric functions",
  ],
  "VECTOR": [
    "geometrical interpretation",
    "equality of two vectors",
  ],
  "3D|THREE DIMENSIONAL|3 D|COORDINATE GEOMETRY": [
    "condition for perpendicularity and parallelism",
    "distance of a point from a plane",
    "distance of a point from a line",
    "projection of a line segment on a line",
  ],
  "DETERMINANT": [
    "system of linear equations",
    "cramer",
    "cramer's rule",
  ],
  "DIFFERENTIAB": [
    "geometrical interpretation",
  ],
  "APPLICATION OF DERIV": [
    "geometric interpretation",
    "error",
    "approximation",
    "rate measurement",
    "rate of change",
  ],
  "INDEFINITE INTEGR": [
    "integration of irrational function",
    "integration of rational function",
    "algebraic twins",
    "integration techniques",
  ],
  "DIFFERENTIAL EQUATION|DIFFERENTAL EQUATION": [
    "solution of d.e",
    "solution of differential equation",
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function banner(title) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(70));
}

async function resolveSubtopicsFlat(subtopicIds, depth = 0) {
  if (!subtopicIds || subtopicIds.length === 0) return [];
  const docs = await Subtopic.find({ _id: { $in: subtopicIds } }).lean();
  const results = [];
  for (const doc of docs) {
    results.push({ ...doc, _depth: depth });
    const nested = await resolveSubtopicsFlat(doc.subtopics, depth + 1);
    results.push(...nested);
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const MONGO_URI = process.env.MAIN_DATABASE_URL;
  if (!MONGO_URI) {
    console.error("❌  MAIN_DATABASE_URL is not set in .env");
    process.exit(1);
  }

  console.log("🔌  Connecting to MAIN DB…");
  await mongoose.connect(MONGO_URI, { dbName: "leadllyQuestions" });
  console.log("✅  Connected\n");

  // ── 1. Find the Maths subject (std 12) ────────────────────────────────────
  const subject = await Subject.findOne({
    standard: 12,
    name: { $regex: /^maths$/i },
  }).lean();

  if (!subject) {
    console.error('❌  Subject "Maths" for standard 12 not found in MAIN DB.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`📘  Subject: "${subject.name}" — ${subject.chapters.length} chapter refs`);

  // ── 2. Fetch all chapters ─────────────────────────────────────────────────
  const allChapters = await Chapter.find({ _id: { $in: subject.chapters } })
    .sort({ chapterNumber: 1, name: 1 })
    .lean();

  console.log(`📂  Chapters in subject: ${allChapters.length}`);

  // ── 3. For each reported-missing group, find the matching chapter(s) ──────
  for (const [chapterPattern, searchTerms] of Object.entries(MISSING)) {
    const regex = new RegExp(chapterPattern, "i");
    const matchedChapters = allChapters.filter((c) => regex.test(c.name));

    banner(`Pattern: "${chapterPattern}"`);

    if (matchedChapters.length === 0) {
      console.log("  ⚠️  No chapters matched this pattern.");
      console.log("  All chapter names:");
      allChapters.forEach((c) =>
        console.log(`    • [${c.chapterNumber ?? "?"}] ${c.name}`)
      );
      continue;
    }

    for (const chapter of matchedChapters) {
      console.log(`\n  📖  Chapter: "${chapter.name}" (chapterNumber: ${chapter.chapterNumber ?? "null"})`);
      console.log(`      _id: ${chapter._id}  |  topic refs: ${chapter.topics.length}`);

      // Fetch topics for this chapter
      const topics = await Topic.find({ _id: { $in: chapter.topics } })
        .sort({ topicNumber: 1, name: 1 })
        .lean();

      console.log(`\n      Topics (${topics.length} total):`);
      for (const topic of topics) {
        const subtopics = await resolveSubtopicsFlat(topic.subtopics);

        // Flag if this topic or any subtopic matches one of our search terms
        const topicMatch = searchTerms.some((t) =>
          topic.name.toLowerCase().includes(t.toLowerCase())
        );
        const subMatches = subtopics.filter((s) =>
          searchTerms.some((t) => s.name.toLowerCase().includes(t.toLowerCase()))
        );

        const marker = topicMatch ? "  ✅ FOUND (topic)" : "     ";
        const indent = "  ".repeat(1);
        console.log(`${indent}${marker}  [${topic.topicNumber ?? "?"}] ${topic.name}  (${subtopics.length} subtopics)`);

        if (subMatches.length > 0) {
          for (const sm of subMatches) {
            console.log(`             ✅ FOUND (subtopic, depth ${sm._depth}): ${sm.name}`);
          }
        }

        // Always print subtopics so we can see what IS there
        for (const sub of subtopics) {
          const indent2 = "  ".repeat(sub._depth + 2);
          console.log(`${indent2}↳ ${sub.name}`);
        }
      }

      // Also do a broader DB search: look for any Topic/Subtopic whose name
      // matches any search term, even if NOT linked via chapter.topics refs
      console.log(`\n  🔍  Broad DB search (Topics collection, chapterName≈"${chapter.name}"):`);
      const broadTopics = await Topic.find({
        standard: 12,
        subjectName: { $regex: /^maths$/i },
        chapterName: { $regex: new RegExp(chapter.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      })
        .sort({ topicNumber: 1, name: 1 })
        .lean();

      if (broadTopics.length !== topics.length) {
        console.log(
          `  ⚠️  chapter.topics refs: ${topics.length}, but Topic collection has ${broadTopics.length} docs with this chapterName`
        );
        const refdIds = new Set(topics.map((t) => t._id.toString()));
        const unrefd = broadTopics.filter((t) => !refdIds.has(t._id.toString()));
        if (unrefd.length > 0) {
          console.log(`  🚨  UNREFERENCED topics (exist in DB but NOT in chapter.topics array):`);
          for (const t of unrefd) {
            console.log(`       • [${t.topicNumber ?? "?"}] ${t.name}  (_id: ${t._id})`);
            const subs = await resolveSubtopicsFlat(t.subtopics);
            for (const s of subs) {
              const indent2 = "  ".repeat(s._depth + 3);
              console.log(`${indent2}↳ ${s.name}`);
            }
          }
        }
      } else {
        console.log(`  ✅  All DB topics are referenced by chapter.topics (count: ${topics.length})`);
      }

      // Broad subtopic search
      console.log(`\n  🔍  Broad DB search (Subtopics collection, chapterName≈"${chapter.name}"):`);
      const broadSubs = await Subtopic.find({
        standard: 12,
        subjectName: { $regex: /^maths$/i },
        chapterName: { $regex: new RegExp(chapter.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      }).lean();

      // Collect all subtopic IDs already reachable via topics
      const allReachableSubs = new Set();
      for (const topic of topics) {
        const subs = await resolveSubtopicsFlat(topic.subtopics);
        subs.forEach((s) => allReachableSubs.add(s._id.toString()));
      }

      const unreachableSubs = broadSubs.filter(
        (s) => !allReachableSubs.has(s._id.toString())
      );
      if (unreachableSubs.length > 0) {
        console.log(
          `  🚨  UNREACHABLE subtopics (in DB but not reachable via topic refs): ${unreachableSubs.length}`
        );
        for (const s of unreachableSubs) {
          console.log(`       • ${s.name}  (topicName: "${s.topicName}", _id: ${s._id})`);
        }
      } else {
        console.log(`  ✅  All DB subtopics are reachable via topic refs`);
      }
    }
  }

  // ── 4. Summary: dump ALL chapters with their topic counts ─────────────────
  banner("ALL CHAPTERS — topic ref counts vs actual DB topic counts");
  for (const chapter of allChapters) {
    const dbTopics = await Topic.countDocuments({
      standard: 12,
      subjectName: { $regex: /^maths$/i },
      chapterName: { $regex: new RegExp(chapter.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    });
    const refCount = chapter.topics.length;
    const mismatch = dbTopics !== refCount ? "  ⚠️  MISMATCH" : "";
    console.log(
      `  [${String(chapter.chapterNumber ?? "?").padStart(2)}] ${chapter.name.padEnd(50)} refs: ${refCount}  db: ${dbTopics}${mismatch}`
    );
  }

  await mongoose.disconnect();
  console.log("\n✅  Done.");
}

run().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
