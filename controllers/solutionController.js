import { Solution } from "../model/solutionModel.js";
import { Ques } from "../model/quesModel.js";
import { runWithBedrock } from "../ai/agents/solutionAgent.js";

// ─────────────────────────────────────────────────────────────────────────────
//  getSolutionBulkStatus  →  GET /api/solution/bulk-status?ids=id1,id2,...
//  Returns a map of { questionId: true } for questions that have a solution.
//  IDs without a solution are simply absent from the map.
// ─────────────────────────────────────────────────────────────────────────────
export const getSolutionBulkStatus = async (req, res) => {
  try {
    const ids = (req.query.ids || "").split(",").filter(Boolean);
    if (ids.length === 0) {
      return res.status(200).json({ success: true, status: {} });
    }

    const solutions = await Solution.find(
      { questionId: { $in: ids } },
      { questionId: 1 }
    );

    const status = {};
    solutions.forEach((s) => { status[s.questionId.toString()] = true; });

    return res.status(200).json({ success: true, status });
  } catch (error) {
    console.error("[SolutionController] getSolutionBulkStatus error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  createSolution  →  POST /api/solution/create
// ─────────────────────────────────────────────────────────────────────────────
export const createSolution = async (req, res) => {
  try {
    const { questionId, content } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, message: "questionId is required." });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "content is required." });
    }

    const solution = await Solution.create({
      questionId,
      content: content.trim(),
      createdBy: req.user?._id,
    });

    return res.status(201).json({ success: true, solution });
  } catch (error) {
    console.error("[SolutionController] createSolution error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getSolution  →  GET /api/solution/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getSolution = async (req, res) => {
  try {
    const solution = await Solution.findById(req.params.id);
    if (!solution) {
      return res.status(404).json({ success: false, message: "Solution not found." });
    }
    return res.status(200).json({ success: true, solution });
  } catch (error) {
    console.error("[SolutionController] getSolution error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getSolutionsByQuestion  →  GET /api/solution/question/:questionId
//  Returns all solutions linked to a given question
// ─────────────────────────────────────────────────────────────────────────────
export const getSolutionsByQuestion = async (req, res) => {
  try {
    const solutions = await Solution.find({ questionId: req.params.questionId }).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, solutions });
  } catch (error) {
    console.error("[SolutionController] getSolutionsByQuestion error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  generateSolution  →  POST /api/solution/generate/:questionId
//
//  Generates a worked solution via AI but does NOT save it.
//  Returns { content } so the frontend can preview it first.
//  The user must explicitly call POST /api/solution/create to persist it.
// ─────────────────────────────────────────────────────────────────────────────
export const generateSolution = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Ques.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    const correctOption = question.options.find((o) => o.tag === "Correct");

    const chapterText   = Array.isArray(question.chapter)   ? question.chapter.join(", ")   : (question.chapter   || "N/A");
    const topicsText    = Array.isArray(question.topics)     ? question.topics.join(", ")     : (question.topics    || "N/A");
    const subtopicsText = Array.isArray(question.subtopics)  ? question.subtopics.join(", ")  : (question.subtopics || "N/A");

    const optionLines = question.options
      .map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o.name}${o.tag === "Correct" ? "  ✓ (Correct)" : ""}`)
      .join("\n");

    const userMessage = [
      `CURRICULUM CONTEXT`,
      `Standard  : ${question.standard || "N/A"}`,
      `Subject   : ${question.subject  || "N/A"}`,
      `Chapter   : ${chapterText}`,
      `Topics    : ${topicsText}`,
      `Subtopics : ${subtopicsText}`,
      `Level     : ${question.level    || "N/A"}`,
      ``,
      `QUESTION`,
      question.question,
      ``,
      `OPTIONS`,
      optionLines,
      ``,
      `Correct Answer: ${correctOption?.name || "N/A"}`,
      ``,
      `Write a complete worked solution for this question following the instructions in your system prompt.`,
    ].join("\n");

    console.log(`[SolutionController] Generating AI solution for question ${questionId}`);

    const rawText = await runWithBedrock(userMessage);

    let content = "";
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      content = parsed?.content?.trim() || rawText.trim();
    } catch {
      content = rawText.trim();
    }

    if (!content) {
      return res.status(500).json({ success: false, message: "AI returned an empty solution." });
    }

    // Return the generated content only — do NOT persist yet.
    // The client will call POST /api/solution/create after user confirms.
    return res.status(200).json({ success: true, content });
  } catch (error) {
    console.error("[SolutionController] generateSolution error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};
