/**
 * ai/tools/insertTools.js
 *
 * Thin wrappers that adapt the AI agent's tool interface → shared functions layer.
 * All actual DB logic lives in /functions/*.js
 */
import { createSubject } from "../../functions/subjectFunctions.js";
import { createChapter } from "../../functions/chapterFunctions.js";
import { createTopic } from "../../functions/topicFunctions.js";
import { createSubtopic } from "../../functions/subtopicFunctions.js";
import { createQuestion } from "../../functions/questionFunctions.js";

// Re-export with the same names the agent uses
export { createSubject as insertSubject };
export { createChapter as insertChapter };
export { createTopic as insertTopic };
export { createSubtopic as insertSubtopic };
export { createQuestion as insertQuestion };
