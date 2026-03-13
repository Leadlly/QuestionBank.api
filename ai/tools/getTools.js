/**
 * ai/tools/getTools.js
 *
 * Thin wrappers that adapt the AI agent's tool interface → shared functions layer.
 * All actual DB logic lives in /functions/*.js
 */
import { getSubjects } from "../../functions/subjectFunctions.js";
import { getChapters } from "../../functions/chapterFunctions.js";
import { getTopics } from "../../functions/topicFunctions.js";
import { getSubtopics } from "../../functions/subtopicFunctions.js";
import { getQuestions } from "../../functions/questionFunctions.js";

export { getSubjects, getChapters, getTopics, getSubtopics, getQuestions };
