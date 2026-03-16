import { runSupervisor } from "../ai/agents/supervisorAgent.js";
import { runSegregationAgent } from "../ai/agents/segregationAgent.js";
import { runQuestionAgent, streamQuestionAgent } from "../ai/agents/questionAgent.js";
import { getLevelPrompt, solutionPrompt } from "../ai/prompts/index.js";

const VALID_AGENT_TYPES = ["supervisor", "segregation", "question"];

// ─────────────────────────────────────────────────────────────────────────────
//  Shared helper — builds the merged system-prompt for the question agent.
//  Used by both runAgent and streamAgent so the logic stays DRY.
// ─────────────────────────────────────────────────────────────────────────────
function buildQuestionSystemPrompt({ standard, subject, chapter, topic, subtopic, level, includeSolutions, callerPrompt }) {
  const contextLines = [
    `Standard / Class : ${standard}`,
    `Subject          : ${subject}`,
    `Chapter          : ${chapter}`,
    topic    ? `Topic            : ${topic}`    : null,
    subtopic ? `Subtopic         : ${subtopic}` : null,
    level    ? `Level            : ${level}`    : null,
  ].filter(Boolean);

  const sessionContext = [
    "SESSION CONTEXT — generate questions ONLY within this scope:",
    contextLines.join("\n"),
    "",
    "Rules enforced for this session:",
    `- Every question MUST belong to Standard ${standard}, Subject "${subject}", Chapter "${chapter}".`,
    topic    ? `- Questions must be under Topic "${topic}".`    : "- Topic is not specified; cover the chapter broadly.",
    subtopic ? `- Narrow down further to Subtopic "${subtopic}".` : null,
    level
      ? `- ALL questions MUST be at difficulty level "${level}". Do NOT mix difficulty levels.`
      : "- Use default difficulty distribution: 40% Easy, 40% Medium, 20% Hard.",
    "- Do NOT generate questions outside the above scope, even if asked.",
    "- Do NOT save anything to a database. Return ONLY the JSON array.",
    includeSolutions
      ? "- For EVERY question, include a detailed `solution` object (see schema below)."
      : "- Do NOT include a solution field in any question.",
  ].filter((l) => l !== null).join("\n");

  const solutionSchemaBlock = includeSolutions ? solutionPrompt : null;

  const levelPromptBlock = getLevelPrompt(level);

  return [
    sessionContext,
    solutionSchemaBlock,
    levelPromptBlock,
    callerPrompt?.trim() || null,
  ].filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  runAgent  →  POST /api/agent/run
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Unified agent runner.
 *
 * Body:
 *   agentType*          "supervisor" | "segregation" | "question"
 *   message*            The user's task (string)
 *   customSystemPrompt  Optional. Injected with PRIORITY after the default prompt.
 *   history             Optional. Previous turns for multi-turn sessions.
 *
 *   ── Only for agentType === "question" ──────────────────────────────────
 *   standard*           Class / grade number  e.g. 11          (required)
 *   subject*            Subject name          e.g. "Physics"   (required)
 *   chapter*            Chapter name          e.g. "Kinematics"(required)
 *   topic               Topic name            e.g. "Projectile Motion" (optional)
 *   subtopic            Subtopic name         (optional)
 *   level               Difficulty level      e.g. "neet" | "jeemains" (optional)
 *   includeSolutions    Boolean — if true, model also generates a worked solution per question
 *   provider            AI provider: "bedrock" (default) | "gemini" (optional)
 */

export const runAgent = async (req, res) => {
  try {
    const {
      agentType,
      message,
      history = [],
      // question-agent curriculum scope
      standard,
      subject,
      chapter,
      topic,
      subtopic,
      level,
      // Whether to generate a worked solution for each question
      includeSolutions = false,
      // AI provider: "bedrock" (default) | "gemini"
      provider = "bedrock",
    } = req.body;

    let { customSystemPrompt = "" } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    if (!agentType || !VALID_AGENT_TYPES.includes(agentType)) {
      return res.status(400).json({
        success: false,
        message: `agentType is required. Must be one of: ${VALID_AGENT_TYPES.join(", ")}.`,
      });
    }

    // ── Question-agent specific validation & context injection ──────────────
    if (agentType === "question") {
      const missing = [];
      if (!standard) missing.push("standard");
      if (!subject)  missing.push("subject");
      if (!chapter)  missing.push("chapter");

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `For agentType "question", the following fields are required: ${missing.join(", ")}.`,
        });
      }

      customSystemPrompt = buildQuestionSystemPrompt({
        standard, subject, chapter, topic, subtopic, level,
        includeSolutions,
        callerPrompt: customSystemPrompt,
      });
    }

    console.log(`[AgentController] type=${agentType} | provider=${provider} | customPrompt=${!!customSystemPrompt}`);

    let result;

    if (agentType === "supervisor") {
      result = await runSupervisor(message, history, customSystemPrompt);
    } else if (agentType === "segregation") {
      result = await runSegregationAgent(message, history, customSystemPrompt);
    } else if (agentType === "question") {
      result = await runQuestionAgent(message, history, customSystemPrompt, provider);
    }

    const responsePayload = {
      success: true,
      agentType,
      reply: result.reply,
      history: result.history,
    };

    // For the question agent return the structured questions array directly
    if (agentType === "question" && Array.isArray(result.questions)) {
      responsePayload.questions = result.questions;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("[AgentController] runAgent error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  chat  →  POST /api/agent/chat  (Supervisor, legacy)
// ─────────────────────────────────────────────────────────────────────────────
export const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const { reply, history: updatedHistory } = await runSupervisor(message, history);

    return res.status(200).json({ success: true, reply, history: updatedHistory });
  } catch (error) {
    console.error("[AgentController] chat error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  segregate  →  POST /api/agent/segregate
// ─────────────────────────────────────────────────────────────────────────────
export const segregate = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const { reply, history: updatedHistory } = await runSegregationAgent(message, history);

    return res.status(200).json({ success: true, reply, history: updatedHistory });
  } catch (error) {
    console.error("[AgentController] segregate error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  generateQuestions  →  POST /api/agent/questions
// ─────────────────────────────────────────────────────────────────────────────
export const generateQuestions = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const { reply, history: updatedHistory } = await runQuestionAgent(message, history);

    return res.status(200).json({ success: true, reply, history: updatedHistory });
  } catch (error) {
    console.error("[AgentController] generateQuestions error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  streamAgent  →  POST /api/agent/stream
//  Same params as /api/agent/run (agentType must be "question").
//  Responds with Server-Sent Events — keeps connection alive while Bedrock
//  streams tokens, then emits a final `done` event with the parsed questions.
// ─────────────────────────────────────────────────────────────────────────────
export const streamAgent = async (req, res) => {
  try {
    const {
      message,
      standard,
      subject,
      chapter,
      topic,
      subtopic,
      level,
      includeSolutions = false,
      customSystemPrompt: callerPrompt = "",
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const missing = [];
    if (!standard) missing.push("standard");
    if (!subject)  missing.push("subject");
    if (!chapter)  missing.push("chapter");
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Fields required: ${missing.join(", ")}.`,
      });
    }

    const systemPrompt = buildQuestionSystemPrompt({
      standard, subject, chapter, topic, subtopic, level,
      includeSolutions,
      callerPrompt,
    });

    console.log(`[AgentController:Stream] standard=${standard} subject=${subject} chapter=${chapter}`);

    // Delegates SSE setup + streaming + final `done` event to the agent
    await streamQuestionAgent(message, systemPrompt, res);
  } catch (error) {
    console.error("[AgentController] streamAgent error:", error);
    // Headers may already be sent; try to emit an error SSE event
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    }
  }
};
