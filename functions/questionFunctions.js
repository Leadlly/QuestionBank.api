import mongoose from "mongoose";
import { Ques } from "../model/quesModel.js";

// ─────────────────────────────────────────────────────────────────────────────
//  createQuestion
//  Pure version of quesController.createQuestion — no image processing,
//  no req.user coupling. Suitable for AI agent use and direct programmatic calls.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}   params.question
 * @param {Array}    params.options        - [{ name, tag: "Correct"|"Incorrect" }]
 * @param {number}   [params.standard]
 * @param {string}   [params.subject]
 * @param {Array}    [params.chapter]      - chapter name strings or { name, _id } objects
 * @param {Array}    [params.topics]       - topic name strings or { name, _id } objects
 * @param {Array}    [params.subtopics]    - subtopic name strings or { name, _id } objects
 * @param {string}   [params.level]        - "Easy"|"Medium"|"Hard"
 * @param {string}   [params.mode]         - "MCQ"|"True/False"|"Short Answer"
 * @param {string}   [params.nestedSubTopic]
 * @param {string}   [params.createdBy]   - User ObjectId string (optional for AI-created questions)
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function createQuestion({
  question,
  options = [],
  standard,
  subject,
  chapter = [],
  topics = [],
  subtopics = [],
  level,
  mode,
  nestedSubTopic,
  createdBy,
}) {
  if (!question) return { success: false, error: "question text is required." };

  // Normalise chapter/topics/subtopics — accept either strings or { name, _id } objects
  const normaliseNames = (arr) =>
    arr.map((el) => (typeof el === "string" ? el : el?.name)).filter(Boolean);

  const normaliseIds = (arr) =>
    arr
      .map((el) => (el?._id ? new mongoose.Types.ObjectId(el._id) : null))
      .filter(Boolean);

  const chapterNames = normaliseNames(chapter);
  const topicNames = normaliseNames(topics);
  const subtopicNames = normaliseNames(subtopics);
  const chaptersId = normaliseIds(chapter);
  const topicsId = normaliseIds(topics);
  const subtopicsId = normaliseIds(subtopics);

  // Validate options
  const hasCorrect = options.some((o) => o.tag === "Correct");
  if (options.length > 0 && !hasCorrect) {
    return { success: false, error: "At least one option must be marked as Correct." };
  }

  // Duplicate guard
  const exists = await Ques.findOne({ question, subject, standard });
  if (exists) {
    return { success: false, error: "Question already exists.", data: exists };
  }

  const newQuestion = new Ques({
    question,
    options,
    standard,
    subject,
    chapter: chapterNames,
    topics: topicNames,
    subtopics: subtopicNames,
    chaptersId,
    topicsId,
    subtopicsId,
    level,
    mode,
    nestedSubTopic,
    ...(createdBy ? { createdBy: new mongoose.Types.ObjectId(createdBy) } : {}),
  });

  await newQuestion.save();
  return { success: true, message: "Question created successfully.", data: newQuestion };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getQuestions
//  Flexible query — mirrors getAllQuestion logic (minus role/pagination concern).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} [query]
 * @param {string}  [query.subject]
 * @param {number}  [query.standard]
 * @param {string}  [query.level]
 * @param {string}  [query.mode]
 * @param {string}  [query.chapter]     - partial match on chapter array element
 * @param {string}  [query.topics]      - partial match on topics array element
 * @param {string}  [query.subtopics]   - partial match on subtopics array element
 * @param {string}  [query.chapterId]   - ObjectId filter via chaptersId
 * @param {string}  [query.topicId]     - ObjectId filter via topicsId
 * @param {string}  [query.search]      - free-text search on question field
 * @param {number}  [query.page]        - default 1
 * @param {number}  [query.limit]       - default 50
 * @returns {Promise<{ success: boolean, data?: Array, total?: number, error?: string }>}
 */
export async function getQuestions(query = {}) {
  const filter = {};

  if (query.subject) filter.subject = new RegExp(query.subject, "i");
  if (query.standard !== undefined) filter.standard = Number(query.standard);
  if (query.level) filter.level = new RegExp(query.level, "i");
  if (query.mode) filter.mode = new RegExp(query.mode, "i");
  if (query.chapter) filter.chapter = { $elemMatch: { $regex: query.chapter, $options: "i" } };
  if (query.topics) filter.topics = { $elemMatch: { $regex: query.topics, $options: "i" } };
  if (query.subtopics) filter.subtopics = { $elemMatch: { $regex: query.subtopics, $options: "i" } };
  if (query.chapterId) filter.chaptersId = { $in: [new mongoose.Types.ObjectId(query.chapterId)] };
  if (query.topicId) filter.topicsId = { $in: [new mongoose.Types.ObjectId(query.topicId)] };
  if (query.search) {
    const terms = query.search.split(" ").filter(Boolean);
    filter.$and = [{ $or: terms.map((t) => ({ question: new RegExp(t, "i") })) }];
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Ques.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    Ques.countDocuments(filter),
  ]);

  return { success: true, data, total, page, limit };
}

// ─────────────────────────────────────────────────────────────────────────────
//  updateQuestionDetails
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} questionId
 * @param {object} updates - { standard, subject, chapter, topics, subtopics, level }
 */
export async function updateQuestionDetails(questionId, updates) {
  if (!questionId) return { success: false, error: "questionId is required." };

  const question = await Ques.findById(questionId);
  if (!question) return { success: false, error: "Question not found." };

  const { standard, subject, chapter, topics, subtopics, level } = updates;

  if (standard) question.standard = standard;
  if (level) question.level = level;

  if (subject && subject !== question.subject) {
    question.subject = subject;
    question.chapter = [];
    question.topics = [];
    question.subtopics = [];
  } else {
    if (chapter) {
      question.chapter = chapter.map((el) => (typeof el === "string" ? el : el.name));
      question.chaptersId = chapter
        .filter((el) => el?._id)
        .map((el) => new mongoose.Types.ObjectId(el._id));
    }
    if (topics) {
      question.topics = topics.map((el) => (typeof el === "string" ? el : el.name));
      question.topicsId = topics
        .filter((el) => el?._id)
        .map((el) => new mongoose.Types.ObjectId(el._id));
    }
    if (subtopics) {
      question.subtopics = subtopics.map((el) => (typeof el === "string" ? el : el.name));
      question.subtopicsId = subtopics
        .filter((el) => el?._id)
        .map((el) => new mongoose.Types.ObjectId(el._id));
    }
  }

  await question.save();
  return { success: true, message: "Question updated successfully.", data: question };
}

// ─────────────────────────────────────────────────────────────────────────────
//  deleteQuestion
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteQuestion(id) {
  if (!id) return { success: false, error: "Question ID is required." };
  const q = await Ques.findByIdAndDelete(id);
  if (!q) return { success: false, error: "Question not found." };
  return { success: true, message: "Question deleted." };
}
