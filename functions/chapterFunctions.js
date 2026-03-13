import { Chapter } from "../model/chapterModel.js";
import { Subject } from "../model/subjectModel.js";
import { Topic } from "../model/topicModel.js";
import { Subtopic } from "../model/subtopicModel.js";
import { Ques } from "../model/quesModel.js";

// ─────────────────────────────────────────────────────────────────────────────
//  createChapter
//  Mirrors logic in chapterController.createChapter.
//  Supports creating a single chapter (with any topics) under an existing subject.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}   params.name          - Chapter name
 * @param {string}   params.subjectName   - Parent subject name
 * @param {number}   params.standard      - Class/grade
 * @param {number}   [params.chapterNumber]
 * @param {string[]} [params.exam]        - Exam tags
 * @param {string[]} [params.topics]      - Optional topic names to create immediately
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function createChapter({ name, subjectName, standard, chapterNumber, exam = [], topics = [] }) {
  if (!name || !subjectName || standard === undefined) {
    return { success: false, error: "name, subjectName, and standard are required." };
  }

  // Verify parent subject exists
  const existingSubject = await Subject.findOne({ name: subjectName, standard }).populate("chapters");
  if (!existingSubject) {
    return { success: false, error: `Subject '${subjectName}' (standard ${standard}) not found.` };
  }

  // Duplicate check
  const alreadyExists = existingSubject.chapters.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (alreadyExists) {
    return { success: false, error: `Chapter "${name}" already exists.`, data: alreadyExists };
  }

  // Create chapter
  const newChapter = new Chapter({ name, subjectName, standard, chapterNumber: chapterNumber ?? null, exam });

  // Create any topics provided
  for (const topicName of topics) {
    const newTopic = new Topic({
      name: topicName,
      subjectName,
      chapterName: name,
      chapterId: newChapter._id,
      standard,
    });
    await newTopic.save();
    newChapter.topics.push(newTopic._id);
  }

  await newChapter.save();

  // Link chapter to subject
  existingSubject.chapters.push(newChapter._id);
  await existingSubject.save();

  return { success: true, message: "Chapter created successfully.", data: newChapter };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getChapters
//  Mirrors logic from chapterController.getChapter (simplified – no aggregate).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} [query]
 * @param {string} [query.name]
 * @param {string} [query.subjectName]
 * @param {number} [query.standard]
 * @param {number} [query.chapterNumber]
 * @returns {Promise<{ success: boolean, data?: Array, error?: string }>}
 */
export async function getChapters(query = {}) {
  const filter = {};
  if (query.name) filter.name = { $regex: new RegExp(query.name, "i") };
  if (query.subjectName) filter.subjectName = { $regex: new RegExp(`^${query.subjectName}$`, "i") };
  if (query.standard !== undefined) filter.standard = Number(query.standard);
  if (query.chapterNumber !== undefined) filter.chapterNumber = Number(query.chapterNumber);

  const data = await Chapter.find(filter).populate("topics").lean();
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getChapterById
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} id - MongoDB ObjectId string
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function getChapterById(id) {
  if (!id) return { success: false, error: "Chapter ID is required." };
  const chapter = await Chapter.findById(id).populate("topics").lean();
  if (!chapter) return { success: false, error: "Chapter not found." };
  return { success: true, data: chapter };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateChapter
//  Renames a chapter and cascades the rename to Topics, Subtopics, and Ques.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} id   - Chapter ObjectId
 * @param {string} name - New chapter name
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateChapter(id, name) {
  if (!id || !name) return { success: false, error: "Chapter ID and new name are required." };

  const chapter = await Chapter.findById(id);
  if (!chapter) return { success: false, error: "Chapter not found." };

  const oldName = chapter.name;
  chapter.name = name;
  await chapter.save();

  // Cascade
  await Topic.updateMany({ chapterName: oldName }, { $set: { chapterName: name } });
  await Subtopic.updateMany({ chapterName: oldName }, { $set: { chapterName: name } });
  await Ques.updateMany(
    { chapter: oldName },
    { $set: { "chapter.$[elem]": name } },
    { arrayFilters: [{ elem: oldName }] }
  );

  return { success: true, message: "Chapter renamed successfully across all collections.", data: chapter };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateChapterNumber
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} chapterId
 * @param {string} subjectName
 * @param {number|null} chapterNumber
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateChapterNumber(chapterId, subjectName, chapterNumber) {
  if (!chapterId || !subjectName || chapterNumber === undefined) {
    return { success: false, error: "chapterId, subjectName, and chapterNumber are required." };
  }

  // Guard against duplicate chapter numbers within the subject
  if (chapterNumber !== null) {
    const conflict = await Chapter.findOne({ subjectName, chapterNumber });
    if (conflict && conflict._id.toString() !== chapterId) {
      return {
        success: false,
        error: `Chapter number ${chapterNumber} is already assigned in subject "${subjectName}".`,
      };
    }
  }

  const updated = await Chapter.findByIdAndUpdate(
    chapterId,
    { chapterNumber: chapterNumber ?? null },
    { new: true, runValidators: true }
  );
  if (!updated) return { success: false, error: "Chapter not found." };
  return { success: true, message: "Chapter number updated.", data: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateChapterExamTags
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string}   chapterId
 * @param {string[]} examTags
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateChapterExamTags(chapterId, examTags) {
  if (!chapterId || !Array.isArray(examTags)) {
    return { success: false, error: "chapterId and examTags (array) are required." };
  }
  const updated = await Chapter.findByIdAndUpdate(
    chapterId,
    { $set: { exam: examTags } },
    { new: true }
  );
  if (!updated) return { success: false, error: "Chapter not found." };
  return { success: true, message: "Exam tags updated.", data: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
//  deleteChapter
//  Deletes only if no questions or topics are linked.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} id - Chapter ObjectId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteChapter(id) {
  if (!id) return { success: false, error: "Chapter ID is required." };

  const chapter = await Chapter.findById(id);
  if (!chapter) return { success: false, error: "Chapter not found." };

  const [qCount, tCount] = await Promise.all([
    Ques.countDocuments({ chapters: chapter.name }),
    Topic.countDocuments({ chapterName: chapter.name }),
  ]);

  if (qCount > 0 || tCount > 0) {
    return {
      success: false,
      error: `Cannot delete — chapter is linked to ${qCount} question(s) and ${tCount} topic(s).`,
    };
  }

  await Chapter.findByIdAndDelete(id);
  await Subject.updateMany({ chapters: id }, { $pull: { chapters: id } });

  return { success: true, message: "Chapter deleted successfully." };
}
