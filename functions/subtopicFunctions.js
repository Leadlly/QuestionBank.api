import { Subtopic } from "../model/subtopicModel.js";
import { Topic } from "../model/topicModel.js";
import { Ques } from "../model/quesModel.js";

// ─────────────────────────────────────────────────────────────────────────────
//  createSubtopic
//  Mirrors the recursive logic in subtopicController.createSubtopic.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}   params.name        - Subtopic name
 * @param {string}   params.topicName   - Parent topic name
 * @param {string}   params.chapterName
 * @param {string}   params.subjectName
 * @param {string}   params.topicId     - Parent topic ObjectId string
 * @param {string}   params.chapterId   - Parent chapter ObjectId string
 * @param {number}   params.standard
 * @param {Array}    [params.subtopics] - Optional nested sub-subtopics array ([{ name, subtopics? }])
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function createSubtopic({ name, topicName, chapterName, subjectName, topicId, chapterId, standard, subtopics = [] }) {
  if (!name || !topicName || !chapterName || !subjectName || standard === undefined) {
    return {
      success: false,
      error: "name, topicName, chapterName, subjectName, and standard are required.",
    };
  }

  // Resolve topicId/chapterId if not passed
  let resolvedTopicId = topicId;
  let resolvedChapterId = chapterId;

  if (!resolvedTopicId) {
    const topic = await Topic.findOne({ name: topicName, chapterName });
    if (!topic) {
      return { success: false, error: `Topic '${topicName}' not found in chapter '${chapterName}'.` };
    }
    resolvedTopicId = topic._id;
    resolvedChapterId = resolvedChapterId ?? topic.chapterId;
  }

  // Duplicate check at the topic level
  const existing = await Subtopic.findOne({ name, topicId: resolvedTopicId });
  if (existing) {
    return { success: false, error: `Subtopic "${name}" already exists under topic '${topicName}'.`, data: existing };
  }

  // Use the recursive helper (which also handles nested subtopics)
  const created = await _addSubtopicRecursive(
    { subtopics: [] },             // fake parent with an empty subtopics array
    { name, subtopics },           // the first subtopic record
    { topicName, chapterName, subjectName, topicId: resolvedTopicId, chapterId: resolvedChapterId, standard },
    true                           // isRoot – don't try to save a fake parent
  );

  // Link new subtopic to its parent topic
  await Topic.findByIdAndUpdate(resolvedTopicId, { $addToSet: { subtopics: created._id } });

  return { success: true, message: "Subtopic created successfully.", data: created };
}

/**
 * Internal recursive helper.
 * @param {object} parent        - Mongoose document with a .subtopics array
 * @param {object} subtopicData  - { name, subtopics?: [...] }
 * @param {object} ctx           - shared context (topicName, chapterName, subjectName, topicId, chapterId, standard)
 * @param {boolean} isRoot       - when true, skip saving the parent (parent is the real Topic doc)
 */
async function _addSubtopicRecursive(parent, subtopicData, ctx, isRoot = false) {
  const { topicName, chapterName, subjectName, topicId, chapterId, standard } = ctx;

  const newSubtopic = new Subtopic({
    name: subtopicData.name,
    topicName,
    chapterName,
    subjectName,
    topicId,
    chapterId,
    standard,
    subtopics: [],
  });
  await newSubtopic.save();

  if (!isRoot) {
    parent.subtopics.push(newSubtopic._id);
    await parent.save();
  }

  // Recurse for nested subtopics
  if (Array.isArray(subtopicData.subtopics) && subtopicData.subtopics.length > 0) {
    for (const nested of subtopicData.subtopics) {
      await _addSubtopicRecursive(newSubtopic, nested, ctx);
    }
  }

  return newSubtopic;
}

// ─────────────────────────────────────────────────────────────────────────────
//  createSubtopics  (batch helper)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {Array<{name: string, subtopics?: Array}>} subtopicList
 * @param {object} context - { topicName, topicId?, chapterName, chapterId?, subjectName, standard }
 */
export async function createSubtopics(subtopicList, context) {
  const results = [];
  for (const s of subtopicList) {
    const result = await createSubtopic({ ...context, name: s.name, subtopics: s.subtopics });
    results.push({ name: s.name, ...result });
  }
  return { success: true, results };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getSubtopics
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} [query]
 * @param {string} [query.name]
 * @param {string} [query.topicName]
 * @param {string} [query.chapterName]
 * @param {string} [query.subjectName]
 * @param {number} [query.standard]
 * @param {string} [query.topicId]     - can be comma-separated
 * @param {string} [query.chapterId]   - can be comma-separated
 */
export async function getSubtopics(query = {}) {
  const filter = {};
  if (query.name) filter.name = { $regex: new RegExp(query.name, "i") };
  if (query.topicName) filter.topicName = { $regex: new RegExp(`^${query.topicName}$`, "i") };
  if (query.chapterName) filter.chapterName = { $regex: new RegExp(`^${query.chapterName}$`, "i") };
  if (query.subjectName) filter.subjectName = { $regex: new RegExp(`^${query.subjectName}$`, "i") };
  if (query.standard !== undefined) filter.standard = Number(query.standard);
  if (query.topicId) {
    const ids = query.topicId.includes(",") ? query.topicId.split(",") : [query.topicId];
    filter.topicId = { $in: ids };
  }
  if (query.chapterId) {
    const ids = query.chapterId.includes(",") ? query.chapterId.split(",") : [query.chapterId];
    filter.chapterId = { $in: ids };
  }

  const data = await Subtopic.find(filter).lean();
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateSubtopic  (rename + cascade)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSubtopic(id, newName) {
  if (!id || !newName) return { success: false, error: "Subtopic ID and new name are required." };

  const subtopic = await Subtopic.findById(id);
  if (!subtopic) return { success: false, error: "Subtopic not found." };

  const oldName = subtopic.name;
  subtopic.name = newName;
  await subtopic.save();

  await Ques.updateMany(
    { subtopics: oldName },
    { $set: { "subtopics.$[elem]": newName } },
    { arrayFilters: [{ elem: oldName }] }
  );

  return { success: true, message: "Subtopic renamed.", data: subtopic };
}

// ─────────────────────────────────────────────────────────────────────────────
//  deleteSubtopic
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteSubtopic(id) {
  if (!id) return { success: false, error: "Subtopic ID is required." };

  const subtopic = await Subtopic.findById(id);
  if (!subtopic) return { success: false, error: "Subtopic not found." };

  const qCount = await Ques.countDocuments({ subtopics: subtopic.name });
  if (qCount > 0) {
    return {
      success: false,
      error: `Cannot delete — subtopic is linked to ${qCount} question(s).`,
    };
  }

  await Subtopic.findByIdAndDelete(id);
  await Topic.updateMany({ subtopics: id }, { $pull: { subtopics: id } });
  await Ques.updateMany({ subtopics: subtopic.name }, { $pull: { subtopics: subtopic.name } });

  return { success: true, message: "Subtopic deleted successfully." };
}
