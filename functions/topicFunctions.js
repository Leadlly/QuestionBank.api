import { Topic } from "../model/topicModel.js";
import { Chapter } from "../model/chapterModel.js";
import { Subject } from "../model/subjectModel.js";
import { Subtopic } from "../model/subtopicModel.js";
import { Ques } from "../model/quesModel.js";

// ─────────────────────────────────────────────────────────────────────────────
//  createTopic
//  Mirrors logic in topicController.createTopic.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}   params.name        - Topic name
 * @param {string}   params.chapterName - Parent chapter name
 * @param {string}   params.chapterId   - Parent chapter ObjectId string
 * @param {string}   params.subjectName
 * @param {number}   params.standard
 * @param {number}   [params.topicNumber]
 * @param {string[]} [params.exam]
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function createTopic({ name, chapterName, chapterId, subjectName, standard, topicNumber, exam = [] }) {
  if (!name || !chapterName || !subjectName || standard === undefined) {
    return { success: false, error: "name, chapterName, subjectName, and standard are required." };
  }

  // Resolve chapterId if not provided
  let resolvedChapterId = chapterId;
  if (!resolvedChapterId) {
    const chapter = await Chapter.findOne({ name: chapterName, subjectName });
    if (!chapter) {
      return { success: false, error: `Chapter '${chapterName}' not found for subject '${subjectName}'.` };
    }
    resolvedChapterId = chapter._id;
  }

  // Duplicate check
  const existing = await Topic.findOne({ name, chapterId: resolvedChapterId });
  if (existing) {
    return { success: false, error: `Topic "${name}" already exists in this chapter.`, data: existing };
  }

  const newTopic = new Topic({
    name,
    chapterName,
    chapterId: resolvedChapterId,
    subjectName,
    standard,
    topicNumber: topicNumber ?? null,
    exam,
  });
  await newTopic.save();

  // Link to chapter
  await Chapter.findByIdAndUpdate(resolvedChapterId, { $addToSet: { topics: newTopic._id } });

  return { success: true, message: "Topic created successfully.", data: newTopic };
}

// ─────────────────────────────────────────────────────────────────────────────
//  createTopics  (batch helper)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates multiple topics under one chapter. Skips duplicates and returns results per topic.
 *
 * @param {Array<{name: string, topicNumber?: number, exam?: string[]}>} topicList
 * @param {object} context  - { chapterName, chapterId?, subjectName, standard }
 * @returns {Promise<{ success: boolean, results: Array }>}
 */
export async function createTopics(topicList, context) {
  const results = [];
  for (const t of topicList) {
    const result = await createTopic({ ...context, name: t.name, topicNumber: t.topicNumber, exam: t.exam });
    results.push({ name: t.name, ...result });
  }
  return { success: true, results };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getTopics
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} [query]
 * @param {string} [query.name]
 * @param {string} [query.chapterName]
 * @param {string} [query.chapterId]
 * @param {string} [query.subjectName]
 * @param {number} [query.standard]
 * @returns {Promise<{ success: boolean, data?: Array, error?: string }>}
 */
export async function getTopics(query = {}) {
  const filter = {};
  if (query.name) filter.name = { $regex: new RegExp(query.name, "i") };
  if (query.chapterName) filter.chapterName = { $regex: new RegExp(`^${query.chapterName}$`, "i") };
  if (query.subjectName) filter.subjectName = { $regex: new RegExp(`^${query.subjectName}$`, "i") };
  if (query.standard !== undefined) filter.standard = Number(query.standard);
  if (query.chapterId) {
    const ids = query.chapterId.includes(",") ? query.chapterId.split(",") : [query.chapterId];
    filter.chapterId = { $in: ids };
  }

  const data = await Topic.find(filter).populate("subtopics").lean();
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getTopicById
// ─────────────────────────────────────────────────────────────────────────────
export async function getTopicById(id) {
  if (!id) return { success: false, error: "Topic ID is required." };
  const topic = await Topic.findById(id).populate("subtopics").lean();
  if (!topic) return { success: false, error: "Topic not found." };
  return { success: true, data: topic };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateTopic  (rename + cascade)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} id      - Topic ObjectId
 * @param {string} newName - New topic name
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateTopic(id, newName) {
  if (!id || !newName) return { success: false, error: "Topic ID and new name are required." };

  const topic = await Topic.findById(id);
  if (!topic) return { success: false, error: "Topic not found." };

  const oldName = topic.name;
  topic.name = newName;
  await topic.save();

  // Cascade renames
  await Ques.updateMany({ topics: oldName }, { $set: { "topics.$": newName } });
  await Subtopic.updateMany({ topicName: oldName }, { $set: { topicName: newName } });

  return { success: true, message: "Topic renamed across all collections.", data: topic };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateTopicNumber
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string}     topicId
 * @param {string}     chapterId
 * @param {number|null} newTopicNumber
 */
export async function updateTopicNumber(topicId, chapterId, newTopicNumber) {
  if (!topicId || !chapterId) {
    return { success: false, error: "topicId and chapterId are required." };
  }

  if (newTopicNumber !== null && !isNaN(newTopicNumber)) {
    const conflict = await Topic.findOne({ chapterId, topicNumber: newTopicNumber });
    if (conflict && conflict._id.toString() !== topicId) {
      return { success: false, error: `Topic number ${newTopicNumber} already exists in this chapter.` };
    }
  }

  const topic = await Topic.findById(topicId);
  if (!topic) return { success: false, error: "Topic not found." };

  topic.topicNumber = newTopicNumber === null ? null : newTopicNumber;
  await topic.save();

  const topics = await Topic.find({ chapterId }).sort({ topicNumber: 1 });
  return { success: true, message: "Topic number updated.", data: topic, allTopics: topics };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateTopicExamTags
// ─────────────────────────────────────────────────────────────────────────────
export async function updateTopicExamTags(topicId, examTags) {
  if (!topicId || !Array.isArray(examTags)) {
    return { success: false, error: "topicId and examTags (array) are required." };
  }
  const updated = await Topic.findByIdAndUpdate(topicId, { $set: { exam: examTags } }, { new: true });
  if (!updated) return { success: false, error: "Topic not found." };
  return { success: true, message: "Exam tags updated.", data: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
//  deleteTopic
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Deletes a topic and removes it from its parent chapter.
 * Blocks deletion if questions are linked.
 */
export async function deleteTopic(id) {
  if (!id) return { success: false, error: "Topic ID is required." };

  const topic = await Topic.findById(id);
  if (!topic) return { success: false, error: "Topic not found." };

  const qCount = await Ques.countDocuments({ topics: topic.name });
  if (qCount > 0) {
    return {
      success: false,
      error: `Cannot delete — topic is linked to ${qCount} question(s).`,
    };
  }

  await Topic.findByIdAndDelete(id);
  await Chapter.updateMany({ topics: id }, { $pull: { topics: id } });
  await Subtopic.deleteMany({ _id: { $in: topic.subtopics } });

  return { success: true, message: "Topic and its subtopics deleted successfully." };
}
