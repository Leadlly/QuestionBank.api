import { Subject } from "../model/subjectModel.js";
import { Chapter } from "../model/chapterModel.js";
import { Topic } from "../model/topicModel.js";

// ─────────────────────────────────────────────────────────────────────────────
//  createSubject
//  Mirrors logic in subjectController.createSubject.
//  Returns a plain result object (no req/res).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string} params.name       - Subject name
 * @param {number} params.standard   - Class/grade
 * @param {Array}  [params.chapters] - Optional array of { name, topics[] } to scaffold immediately
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function createSubject({ name, standard, chapters = [] }) {
  if (!name || standard === undefined) {
    return { success: false, error: "name and standard are required." };
  }

  const existing = await Subject.findOne({ name, standard });
  if (existing) {
    return { success: false, error: "Subject already exists.", data: existing };
  }

  const newSubject = new Subject({ name, standard });

  const chapterIds = [];

  for (const chapterData of chapters) {
    const { name: chapterName, topics = [] } = chapterData;
    const topicIds = [];

    for (const topicName of topics) {
      const newTopic = new Topic({ name: topicName, chapterName, subjectName: name, standard });
      await newTopic.save();
      topicIds.push(newTopic._id);
    }

    const newChapter = new Chapter({ name: chapterName, standard, subjectName: name, topics: topicIds });
    await newChapter.save();
    chapterIds.push(newChapter._id);
  }

  newSubject.chapters = chapterIds;
  await newSubject.save();

  return { success: true, message: "Subject created successfully.", data: newSubject };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getSubjects
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} [query]
 * @param {string} [query.name]
 * @param {number} [query.standard]
 * @returns {Promise<{ success: boolean, data?: Array, error?: string }>}
 */
export async function getSubjects(query = {}) {
  const filter = {};
  if (query.name) filter.name = { $regex: new RegExp(`^${query.name}$`, "i") };
  if (query.standard !== undefined) filter.standard = Number(query.standard);

  const data = await Subject.find(filter).populate("chapters").lean();
  return { success: true, data };
}
