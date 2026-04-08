/**
 * applySegregation.js
 *
 * Reads a segregation JSON (the "diff" file) and applies every declared
 * change to the live database:
 *
 *   _action: "none"   → recurse into children, no change to the node itself
 *   _action: "rename" → update the document's `name` field in the DB
 *   _action: "add"    → create a brand-new document (no _id in JSON)
 *                       OR re-parent an existing document by _id into the new
 *                       parent's array (we call this a "move")
 *   _action: "delete" → remove the document from the DB and from its parent's
 *                       reference array.  Questions that referenced this node
 *                       will have their array field cleaned up too.
 *
 * ── WHAT THIS SCRIPT DOES, in order ──────────────────────────────────────────
 *
 *  1. Chapter loop
 *     • rename  → Chapter.updateOne({ name: oldName }, { name: newName })
 *     • add     → new Chapter document inserted; Subject.chapters updated
 *     • delete  → Chapter removed; all its Topics/Subtopics cascade-deleted;
 *                 Questions with chaptersId / chapter references cleaned up.
 *
 *  2. Topic loop (per chapter)
 *     • rename  → Topic.updateOne + update Questions.topics[]/topicsId[]
 *     • add     → new Topic inserted; Chapter.topics updated
 *     • move    → (add node that has an _id) the existing Topic document is
 *                 re-parented: removed from old Chapter.topics if present,
 *                 added to new Chapter.topics; topic's chapterName/chapterId updated.
 *     • delete  → Topic removed; subtopics cascade; Questions cleaned up.
 *
 *  3. Subtopic loop (per topic, recursive)
 *     • rename  → Subtopic.updateOne + update Questions.subtopics[]/subtopicsId[]
 *     • add     → new Subtopic inserted; Topic.subtopics updated
 *     • move    → existing Subtopic re-parented into new Topic (or Subtopic)
 *     • delete  → Subtopic removed; Questions cleaned up.
 *
 * ── QUESTION SAFETY ──────────────────────────────────────────────────────────
 *
 *  • rename: oldName strings stored in Questions are also updated in-place
 *    (chapter[], topics[], subtopics[] arrays of names; chaptersId/topicsId/subtopicsId
 *    are ObjectId-based so they don't need updating on a plain rename).
 *
 *  • move:   The ObjectId stays the same, so Questions already pointing to it
 *    remain valid.  Only the parent's reference array and the document's own
 *    denormalised parent fields change.
 *
 *  • delete: Questions that reference the deleted node have that reference
 *    removed (pull) from their arrays so they don't hold dangling IDs.
 *    A warning is printed so you can review those questions later.
 *
 * ── HOW TO RUN ────────────────────────────────────────────────────────────────
 *
 *  node scripts/standard/11/maths/applySegregation.js
 *
 *  By default it uses the MONGO_URI from .env (pointing to TEST DB).
 *  Set DRY_RUN=true to print every planned operation without touching the DB.
 *
 *    DRY_RUN=true node scripts/standard/11/maths/applySegregation.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DRY_RUN = process.env.DRY_RUN === "true";

// ── Logging helpers ───────────────────────────────────────────────────────────

function log(msg)  { console.log(`[${ts()}]  ${msg}`); }
function warn(msg) { console.warn(`[${ts()}]  ⚠️  ${msg}`); }
function ts()      { return new Date().toISOString(); }

const stats = { renamed: 0, added: 0, moved: 0, deleted: 0, skipped: 0 };

function dryLog(op, detail) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] ${op}: ${detail}`);
    stats[op === "delete" ? "deleted" : op === "add" ? "added" : op === "move" ? "moved" : op === "rename" ? "renamed" : "skipped"]++;
    return true;
  }
  return false;
}

// ── Load + parse JSON (strips // comments and trailing commas) ────────────────

function loadSegregation(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  raw = raw.replace(/\/\/[^\n]*/g, "");       // strip // comments
  raw = raw.replace(/,(\s*[}\]])/g, "$1");    // remove trailing commas
  return JSON.parse(raw);
}

// ── Mongoose inline schemas (mirrors the real models) ────────────────────────

const ObjectId = mongoose.Schema.Types.ObjectId;

const subjectSchema = new mongoose.Schema({
  name: String,
  standard: Number,
  chapters: [{ type: ObjectId, ref: "Chapter" }],
});

const chapterSchema = new mongoose.Schema({
  name: String,
  subjectName: String,
  standard: Number,
  chapterNumber: { type: Number, default: null },
  topics: [{ type: ObjectId, ref: "Topic" }],
  exam: [String],
});

const topicSchema = new mongoose.Schema({
  name: String,
  chapterName: String,
  chapterId: { type: ObjectId, ref: "Chapter" },
  subjectName: String,
  standard: Number,
  topicNumber: { type: Number, default: null },
  subtopics: [{ type: ObjectId, ref: "Subtopic" }],
  exam: [String],
}, { timestamps: true });

const subtopicSchema = new mongoose.Schema({
  name: String,
  topicName: String,
  chapterName: String,
  topicId: { type: ObjectId, ref: "Topic" },
  chapterId: { type: ObjectId, ref: "Chapter" },
  subjectName: String,
  standard: Number,
  subtopics: [{ type: ObjectId, ref: "Subtopic" }],
});

const quesSchema = new mongoose.Schema({
  question: String,
  standard: Number,
  subject: String,
  chaptersId: Array,
  topicsId: Array,
  subtopicsId: Array,
  chapter: Array,
  topics: Array,
  subtopics: Array,
});

const Subject  = mongoose.model("Subject",      subjectSchema);
const Chapter  = mongoose.model("Chapter",      chapterSchema);
const Topic    = mongoose.model("Topic",        topicSchema);
const Subtopic = mongoose.model("Subtopic",     subtopicSchema);
const Ques     = mongoose.model("QuestionBank", quesSchema);

// ── Core operation helpers ────────────────────────────────────────────────────

/**
 * Rename a Chapter and update all Questions that reference it by name.
 */
async function renameChapter(chapterId, oldName, newName) {
  if (dryLog("rename", `Chapter "${oldName}" → "${newName}"`)) return;
  await Chapter.updateOne({ _id: chapterId }, { name: newName });
  // Update denormalised name arrays in Questions
  const qCount = await Ques.countDocuments({ chapter: oldName });
  if (qCount > 0) {
    await Ques.updateMany({ chapter: oldName }, { $set: { "chapter.$[el]": newName } }, {
      arrayFilters: [{ "el": oldName }],
    });
  }
  log(`  ✅ Renamed chapter "${oldName}" → "${newName}" (${qCount} questions updated)`);
  stats.renamed++;
}

/**
 * Rename a Topic and update all Questions that reference it by name.
 */
async function renameTopic(topicId, oldName, newName) {
  if (dryLog("rename", `Topic "${oldName}" → "${newName}"`)) return;
  await Topic.updateOne({ _id: topicId }, { name: newName });
  const qCount = await Ques.countDocuments({ topics: oldName });
  if (qCount > 0) {
    await Ques.updateMany({ topics: oldName }, { $set: { "topics.$[el]": newName } }, {
      arrayFilters: [{ "el": oldName }],
    });
  }
  log(`  ✅ Renamed topic "${oldName}" → "${newName}" (${qCount} questions updated)`);
  stats.renamed++;
}

/**
 * Rename a Subtopic and update all Questions that reference it by name.
 */
async function renameSubtopic(subtopicId, oldName, newName) {
  if (dryLog("rename", `Subtopic "${oldName}" → "${newName}"`)) return;
  await Subtopic.updateOne({ _id: subtopicId }, { name: newName });
  const qCount = await Ques.countDocuments({ subtopics: oldName });
  if (qCount > 0) {
    await Ques.updateMany({ subtopics: oldName }, { $set: { "subtopics.$[el]": newName } }, {
      arrayFilters: [{ "el": oldName }],
    });
  }
  log(`  ✅ Renamed subtopic "${oldName}" → "${newName}" (${qCount} questions updated)`);
  stats.renamed++;
}

/**
 * Add a brand-new Chapter (no existing _id).
 */
async function addChapter(node, subjectId, subjectName, standard) {
  if (dryLog("add", `Chapter "${node.newName}"`)) return null;
  const ch = await Chapter.create({
    name: node.newName,
    subjectName,
    standard,
    exam: node.exam ?? [],
  });
  await Subject.updateOne({ _id: subjectId }, { $addToSet: { chapters: ch._id } });
  log(`  ✅ Added chapter "${node.newName}" (${ch._id})`);
  stats.added++;
  return ch;
}

/**
 * Add a brand-new Topic (no existing _id) under a chapter.
 */
async function addTopic(node, chapter, subjectName) {
  if (dryLog("add", `Topic "${node.newName}" under chapter "${chapter.name}"`)) return null;
  const t = await Topic.create({
    name: node.newName,
    chapterName: chapter.name,
    chapterId: chapter._id,
    subjectName,
    standard: chapter.standard,
    exam: node.exam ?? [],
  });
  await Chapter.updateOne({ _id: chapter._id }, { $addToSet: { topics: t._id } });
  log(`  ✅ Added topic "${node.newName}" (${t._id})`);
  stats.added++;
  return t;
}

/**
 * Move an existing Topic (has _id) into a new Chapter parent.
 * The ObjectId is preserved — Questions are unaffected.
 */
async function moveTopic(topicId, newChapter, subjectName, newName) {
  if (dryLog("move", `Topic ${topicId} "${newName}" → chapter "${newChapter.name}"`)) return;
  const existing = await Topic.findById(topicId);
  if (!existing) { warn(`moveTopic: topic ${topicId} not found`); return; }

  // Remove from old chapter if it exists there
  await Chapter.updateMany({ topics: topicId }, { $pull: { topics: topicId } });

  // Apply rename if needed
  const finalName = newName || existing.name;

  await Topic.updateOne({ _id: topicId }, {
    name: finalName,
    chapterName: newChapter.name,
    chapterId: newChapter._id,
    subjectName,
  });

  await Chapter.updateOne({ _id: newChapter._id }, { $addToSet: { topics: topicId } });
  log(`  ✅ Moved topic "${existing.name}" → chapter "${newChapter.name}"${finalName !== existing.name ? ` (renamed to "${finalName}")` : ""}`);
  stats.moved++;
}

/**
 * Add a brand-new Subtopic under a Topic (or Subtopic parent).
 */
async function addSubtopic(node, parentTopic, chapter, subjectName) {
  if (dryLog("add", `Subtopic "${node.newName}" under topic "${parentTopic.name}"`)) return null;
  const s = await Subtopic.create({
    name: node.newName,
    topicName: parentTopic.name,
    chapterName: chapter.name,
    topicId: parentTopic._id,
    chapterId: chapter._id,
    subjectName,
    standard: chapter.standard,
  });
  await Topic.updateOne({ _id: parentTopic._id }, { $addToSet: { subtopics: s._id } });
  log(`  ✅ Added subtopic "${node.newName}" (${s._id})`);
  stats.added++;
  return s;
}

/**
 * Add a brand-new nested Subtopic under a parent Subtopic.
 */
async function addNestedSubtopic(node, parentSubtopic, chapter, subjectName) {
  if (dryLog("add", `Nested subtopic "${node.newName}" under subtopic "${parentSubtopic.name}"`)) return null;
  const s = await Subtopic.create({
    name: node.newName,
    topicName: parentSubtopic.topicName,
    chapterName: chapter.name,
    topicId: parentSubtopic.topicId,
    chapterId: chapter._id,
    subjectName,
    standard: chapter.standard,
  });
  await Subtopic.updateOne({ _id: parentSubtopic._id }, { $addToSet: { subtopics: s._id } });
  log(`  ✅ Added nested subtopic "${node.newName}" (${s._id})`);
  stats.added++;
  return s;
}

/**
 * Move an existing Subtopic (has _id) under a new Topic parent.
 * ObjectId is preserved — Questions are unaffected.
 */
async function moveSubtopicToTopic(subtopicId, newTopic, chapter, subjectName, newName) {
  if (dryLog("move", `Subtopic ${subtopicId} "${newName}" → topic "${newTopic.name}"`)) return;
  const existing = await Subtopic.findById(subtopicId);
  if (!existing) { warn(`moveSubtopicToTopic: subtopic ${subtopicId} not found`); return; }

  // Remove from any existing topic's subtopics array
  await Topic.updateMany({ subtopics: subtopicId }, { $pull: { subtopics: subtopicId } });
  // Remove from any parent subtopic's subtopics array
  await Subtopic.updateMany({ subtopics: subtopicId }, { $pull: { subtopics: subtopicId } });

  const finalName = newName || existing.name;

  await Subtopic.updateOne({ _id: subtopicId }, {
    name: finalName,
    topicName: newTopic.name,
    chapterName: chapter.name,
    topicId: newTopic._id,
    chapterId: chapter._id,
    subjectName,
  });

  await Topic.updateOne({ _id: newTopic._id }, { $addToSet: { subtopics: subtopicId } });
  log(`  ✅ Moved subtopic "${existing.name}" → topic "${newTopic.name}"${finalName !== existing.name ? ` (renamed to "${finalName}")` : ""}`);
  stats.moved++;
}

/**
 * Delete a Chapter and cascade: delete Topics → Subtopics → clean Questions.
 */
async function deleteChapter(chapterId, chapterName, subjectId) {
  if (dryLog("delete", `Chapter "${chapterName}" (${chapterId})`)) return;

  const chapter = await Chapter.findById(chapterId).lean();
  if (!chapter) { warn(`Chapter ${chapterId} not found, skipping delete`); return; }

  // Cascade delete topics
  for (const topicId of (chapter.topics || [])) {
    await deleteTopic(topicId, null, chapterId, { silent: true });
  }

  // Clean Questions referencing this chapter
  const qCount = await Ques.countDocuments({ chaptersId: chapterId });
  if (qCount > 0) {
    warn(`  Deleting chapter "${chapterName}" — ${qCount} question(s) reference it; cleaning references.`);
    await Ques.updateMany({ chaptersId: chapterId }, {
      $pull: { chaptersId: chapterId, chapter: chapterName },
    });
  }

  await Chapter.deleteOne({ _id: chapterId });
  await Subject.updateOne({ _id: subjectId }, { $pull: { chapters: chapterId } });
  log(`  ✅ Deleted chapter "${chapterName}" (cascade complete)`);
  stats.deleted++;
}

/**
 * Delete a Topic and cascade: delete Subtopics → clean Questions.
 */
async function deleteTopic(topicId, topicName, chapterId, opts = {}) {
  const topic = await Topic.findById(topicId).lean();
  if (!topic) { if (!opts.silent) warn(`Topic ${topicId} not found`); return; }
  const name = topicName || topic.name;

  if (dryLog("delete", `Topic "${name}" (${topicId})`)) return;

  // Cascade delete subtopics
  for (const stId of (topic.subtopics || [])) {
    await deleteSubtopic(stId, null, { silent: true });
  }

  // Clean Questions
  const qCount = await Ques.countDocuments({ topicsId: topicId });
  if (qCount > 0) {
    warn(`  Deleting topic "${name}" — ${qCount} question(s) reference it; cleaning references.`);
    await Ques.updateMany({ topicsId: topicId }, {
      $pull: { topicsId: topicId, topics: name },
    });
  }

  await Topic.deleteOne({ _id: topicId });
  await Chapter.updateOne({ _id: chapterId }, { $pull: { topics: topicId } });
  if (!opts.silent) { log(`  ✅ Deleted topic "${name}"`); stats.deleted++; }
}

/**
 * Delete a Subtopic and clean Questions.
 */
async function deleteSubtopic(subtopicId, subtopicName, opts = {}) {
  const st = await Subtopic.findById(subtopicId).lean();
  if (!st) { if (!opts.silent) warn(`Subtopic ${subtopicId} not found`); return; }
  const name = subtopicName || st.name;

  if (dryLog("delete", `Subtopic "${name}" (${subtopicId})`)) return;

  // Cascade into nested subtopics
  for (const childId of (st.subtopics || [])) {
    await deleteSubtopic(childId, null, { silent: true });
  }

  // Clean Questions
  const qCount = await Ques.countDocuments({ subtopicsId: subtopicId });
  if (qCount > 0) {
    warn(`  Deleting subtopic "${name}" — ${qCount} question(s) reference it; cleaning references.`);
    await Ques.updateMany({ subtopicsId: subtopicId }, {
      $pull: { subtopicsId: subtopicId, subtopics: name },
    });
  }

  await Subtopic.deleteOne({ _id: subtopicId });
  await Topic.updateMany({ subtopics: subtopicId }, { $pull: { subtopics: subtopicId } });
  await Subtopic.updateMany({ subtopics: subtopicId }, { $pull: { subtopics: subtopicId } });

  if (!opts.silent) { log(`  ✅ Deleted subtopic "${name}"`); stats.deleted++; }
}

// ── Recursive processors ──────────────────────────────────────────────────────

/**
 * Process a subtopic node. parentType: "topic" | "subtopic"
 */
async function processSubtopicNode(node, parentDoc, parentType, chapter, subjectName) {
  const action = (node._action || "none").toLowerCase();

  // Resolve the document for nodes that have an _id
  let existingDoc = null;
  if (node._id) {
    existingDoc = await Subtopic.findById(node._id).lean();
  }

  if (action === "none") {
    // No change — recurse into children
    if (node.subtopics?.length) {
      for (const child of node.subtopics) {
        await processSubtopicNode(child, existingDoc || { _id: node._id, name: node.oldName }, "subtopic", chapter, subjectName);
      }
    }

  } else if (action === "rename") {
    if (!node._id) { warn(`rename subtopic missing _id: "${node.newName}"`); return; }
    await renameSubtopic(node._id, node.oldName, node.newName);
    // Recurse
    const doc = existingDoc || await Subtopic.findById(node._id).lean();
    if (node.subtopics?.length && doc) {
      for (const child of node.subtopics) {
        await processSubtopicNode(child, doc, "subtopic", chapter, subjectName);
      }
    }

  } else if (action === "add") {
    if (!node._id) {
      // Pure new subtopic
      let newDoc;
      if (parentType === "topic") {
        newDoc = await addSubtopic(node, parentDoc, chapter, subjectName);
      } else {
        newDoc = await addNestedSubtopic(node, parentDoc, chapter, subjectName);
      }
      // Recurse into children of the newly added subtopic
      if (node.subtopics?.length && newDoc) {
        for (const child of node.subtopics) {
          await processSubtopicNode(child, newDoc, "subtopic", chapter, subjectName);
        }
      }
    } else {
      // Has _id → this is a MOVE of an existing subtopic
      if (parentType === "topic") {
        await moveSubtopicToTopic(node._id, parentDoc, chapter, subjectName, node.newName !== node.oldName ? node.newName : null);
      } else {
        // Move existing subtopic under another subtopic
        if (!DRY_RUN) {
          const existing = await Subtopic.findById(node._id);
          if (existing) {
            await Topic.updateMany({ subtopics: node._id }, { $pull: { subtopics: node._id } });
            await Subtopic.updateMany({ subtopics: node._id }, { $pull: { subtopics: node._id } });
            await Subtopic.updateOne({ _id: parentDoc._id }, { $addToSet: { subtopics: node._id } });
            log(`  ✅ Moved subtopic "${existing.name}" → parent subtopic "${parentDoc.name}"`);
            stats.moved++;
          }
        } else {
          dryLog("move", `Subtopic ${node._id} → parent subtopic "${parentDoc.name}"`);
        }
      }
      // Recurse into children declared under the moved subtopic
      if (node.subtopics?.length) {
        const movedDoc = await Subtopic.findById(node._id).lean();
        if (movedDoc) {
          for (const child of node.subtopics) {
            await processSubtopicNode(child, movedDoc, "subtopic", chapter, subjectName);
          }
        }
      }
    }

  } else if (action === "delete") {
    if (!node._id) { warn(`delete subtopic missing _id: "${node.newName}"`); return; }
    await deleteSubtopic(node._id, node.oldName);
  }
}

/**
 * Process a topic node.
 * "add" without _id → create new topic.
 * "add" with _id    → move existing topic into current chapter.
 */
async function processTopicNode(node, chapter, subject) {
  const action = (node._action || "none").toLowerCase();

  // Note: the JSON sometimes uses "subtopic" (singular) key — normalise it
  const subtopicNodes = node.subtopics || node.subtopic || [];

  if (action === "none") {
    // Recurse into subtopics only
    for (const st of subtopicNodes) {
      const topicDoc = await Topic.findById(node._id).lean();
      if (topicDoc) {
        await processSubtopicNode(st, topicDoc, "topic", chapter, subject.name);
      }
    }

  } else if (action === "rename") {
    if (!node._id) { warn(`rename topic missing _id: "${node.newName}"`); return; }
    await renameTopic(node._id, node.oldName, node.newName);
    const topicDoc = await Topic.findById(node._id).lean();
    for (const st of subtopicNodes) {
      if (topicDoc) await processSubtopicNode(st, topicDoc, "topic", chapter, subject.name);
    }

  } else if (action === "add") {
    if (!node._id) {
      // Pure new topic
      const newTopic = await addTopic(node, chapter, subject.name);
      if (newTopic) {
        for (const st of subtopicNodes) {
          await processSubtopicNode(st, newTopic, "topic", chapter, subject.name);
        }
      }
    } else {
      // Move existing topic into this chapter
      await moveTopic(node._id, chapter, subject.name, node.newName !== node.oldName ? node.newName : null);
      const movedTopic = await Topic.findById(node._id).lean();
      if (movedTopic) {
        for (const st of subtopicNodes) {
          await processSubtopicNode(st, movedTopic, "topic", chapter, subject.name);
        }
      }
    }

  } else if (action === "delete") {
    if (!node._id) { warn(`delete topic missing _id: "${node.newName}"`); return; }
    await deleteTopic(node._id, node.oldName, chapter._id);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function applySegregation() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("❌  MONGO_URI is not set in .env");
    process.exit(1);
  }

  const segregationFile = path.join(__dirname, "11_maths_segregation.json");
  log(`Loading segregation file: ${segregationFile}`);
  const seg = loadSegregation(segregationFile);

  log(`Standard: ${seg.standard} | Subject: ${seg.subject.oldName}`);
  if (DRY_RUN) log("🔵  DRY-RUN mode — no database writes will be made.");

  log("Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI, { dbName: "leadllyQuestions" });
  log("✅  Connected");

  // Find the subject document
  const subject = await Subject.findById(seg.subject._id).lean();
  if (!subject) {
    console.error(`❌  Subject ${seg.subject._id} not found`);
    await mongoose.disconnect();
    process.exit(1);
  }

  log(`\nProcessing ${seg.chapters.length} chapter(s)…\n`);

  for (const chNode of seg.chapters) {
    const chAction = (chNode._action || "none").toLowerCase();
    log(`── Chapter: "${chNode.oldName || chNode.newName}" [${chAction}]`);

    if (chAction === "delete") {
      if (!chNode._id) { warn("delete chapter missing _id"); continue; }
      await deleteChapter(chNode._id, chNode.oldName, subject._id);
      continue;
    }

    // Resolve chapter document
    let chapter;
    if (chAction === "add" && !chNode._id) {
      chapter = await addChapter(chNode, subject._id, subject.name, seg.standard);
      if (!chapter) continue;
    } else {
      chapter = await Chapter.findById(chNode._id).lean();
      if (!chapter) { warn(`Chapter ${chNode._id} not found`); continue; }

      if (chAction === "rename") {
        await renameChapter(chNode._id, chNode.oldName, chNode.newName);
        chapter = await Chapter.findById(chNode._id).lean(); // refresh
      }
    }

    // Process topics
    for (const topicNode of (chNode.topics || [])) {
      await processTopicNode(topicNode, chapter, subject);
    }
  }

  log("\n─────────────────────────────────────────────");
  log(`✅  Done!`);
  log(`   Renamed : ${stats.renamed}`);
  log(`   Added   : ${stats.added}`);
  log(`   Moved   : ${stats.moved}`);
  log(`   Deleted : ${stats.deleted}`);
  if (DRY_RUN) log("🔵  (DRY-RUN — nothing was written)");

  await mongoose.disconnect();
}

applySegregation().catch((err) => {
  console.error("❌  Fatal error:", err);
  mongoose.disconnect();
  process.exit(1);
});
