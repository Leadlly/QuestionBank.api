import { runSupervisor } from "../ai/agents/supervisorAgent.js";
import { runSegregationAgent } from "../ai/agents/segregationAgent.js";
import { runQuestionAgent } from "../ai/agents/questionAgent.js";
import { getLevelPrompt } from "../ai/prompts/index.js";

const VALID_AGENT_TYPES = ["supervisor", "segregation", "question"];

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

      // Build a SESSION CONTEXT block so the LLM is scoped to exactly
      // the requested curriculum node — standard, subject, chapter are
      // mandatory; topic and subtopic narrow the scope further if provided.
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

      // Solution schema supplement — injected only when includeSolutions is requested
      const solutionSchemaBlock = includeSolutions
        ? `
SOLUTION REQUIREMENT (apply to every question):

Each question object MUST include a "solution" key whose value is a single Markdown string
containing a complete, human-quality worked solution — exactly as a top student or teacher
would write it on paper. Store the entire solution in ONE string field called "content".

"solution": {
  "content": "<full markdown solution here>"
}

RULES for writing the solution content:

1. Write the solution as continuous prose + math, NOT as a JSON sub-object or bullet dump.
2. Start with a one-line conceptual statement: what principle / formula / law applies.
3. For NUMERICAL questions:
   - Show every substitution and algebraic step.
   - Write equations inline using plain text math (e.g. F = ma = 5 × 2 = 10 N).
   - Derive intermediate values explicitly; do not skip steps.
   - End with a clearly labelled final answer with correct SI/CGS units.
4. For THEORY / CONCEPTUAL questions:
   - Explain the underlying concept in 2–4 sentences.
   - Reason through why each wrong option is incorrect (process of elimination).
   - Conclude with a statement of the correct answer and why it is right.
5. Use Markdown formatting freely: **bold** for key terms, headings (##), code blocks for
   equations if needed, and horizontal rules to separate sections.
6. Minimum length: 80 words. The solution must be self-contained and fully understandable
   without referring back to the question.
`.trim()
        : null;

      // Attach the exam-level specific prompt (PYQ examples + style guide)
      const levelPromptBlock = getLevelPrompt(level);

      // Merge: session context + level block take top priority over any caller customSystemPrompt
      const priorityBlock = [
        sessionContext,
        solutionSchemaBlock,
        levelPromptBlock,
        customSystemPrompt.trim() || null,
      ].filter(Boolean).join("\n\n");

      customSystemPrompt = priorityBlock;
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
