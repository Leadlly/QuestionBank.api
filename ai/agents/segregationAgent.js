import { agentLoop } from "../lib/agentLoop.js";
import { MODELS } from "../bedrock.js";
import { segregationPrompt } from "../prompts/index.js";
import { mergePrompts } from "../lib/mergePrompts.js";
import {
  insertSubject,
  insertChapter,
  insertTopic,
  insertSubtopic,
} from "../tools/insertTools.js";
import {
  getSubjects,
  getChapters,
  getTopics,
  getSubtopics,
} from "../tools/getTools.js";

// ─── System prompt (defined in ai/prompts/segregationPrompt.js) ──────────────

// ─── Tool definitions (Bedrock schema) ───────────────────────────────────────
const tools = [
  {
    toolSpec: {
      name: "getSubjects",
      description: "Fetch subjects. Optionally filter by name and/or standard.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string" },
            standard: { type: "number" },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "insertSubject",
      description: "Create a new subject (top-level academic entity).",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string", description: "Subject name e.g. 'Physics'" },
            standard: { type: "number", description: "Class / grade e.g. 11" },
          },
          required: ["name", "standard"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "getChapters",
      description: "Fetch chapters. Optionally filter by name, subjectName, standard.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string" },
            subjectName: { type: "string" },
            standard: { type: "number" },
            chapterNumber: { type: "number" },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "insertChapter",
      description: "Create a chapter and link it to its parent subject.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string" },
            subjectName: { type: "string" },
            standard: { type: "number" },
            chapterNumber: { type: "number" },
            exam: { type: "array", items: { type: "string" } },
          },
          required: ["name", "subjectName", "standard"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "getTopics",
      description: "Fetch topics. Optionally filter by name, chapterName, subjectName, standard.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string" },
            chapterName: { type: "string" },
            subjectName: { type: "string" },
            standard: { type: "number" },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "insertTopic",
      description: "Create a topic and link it to its parent chapter.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string" },
            chapterName: { type: "string" },
            subjectName: { type: "string" },
            standard: { type: "number" },
            topicNumber: { type: "number" },
            exam: { type: "array", items: { type: "string" } },
          },
          required: ["name", "chapterName", "subjectName", "standard"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "getSubtopics",
      description: "Fetch subtopics. Optionally filter by name, topicName, chapterName, subjectName, standard.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string" },
            topicName: { type: "string" },
            chapterName: { type: "string" },
            subjectName: { type: "string" },
            standard: { type: "number" },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "insertSubtopic",
      description: "Create a subtopic and link it to its parent topic.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string" },
            topicName: { type: "string" },
            chapterName: { type: "string" },
            subjectName: { type: "string" },
            standard: { type: "number" },
          },
          required: ["name", "topicName", "chapterName", "subjectName", "standard"],
        },
      },
    },
  },
];

// ─── Tool handler map ─────────────────────────────────────────────────────────
const toolHandlers = {
  getSubjects,
  insertSubject,
  getChapters,
  insertChapter,
  getTopics,
  insertTopic,
  getSubtopics,
  insertSubtopic,
};

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Run the Segregation Agent.
 *
 * @param {string} userMessage
 * @param {Array}  history           – previous message turns (for multi-turn)
 * @param {string} [customSystemPrompt] – optional caller-supplied instructions
 *                                       that override the default prompt.
 * @returns {Promise<{ reply: string, history: Array }>}
 */
export async function runSegregationAgent(userMessage, history = [], customSystemPrompt = "") {
  console.log("[SegregationAgent] task:", userMessage);

  const messages = [
    ...history,
    { role: "user", content: [{ text: userMessage }] },
  ];

  const reply = await agentLoop({
    modelId: MODELS.DEFAULT,
    tools,
    toolHandlers,
    messages,
  });

  return { reply, history: messages };
}
