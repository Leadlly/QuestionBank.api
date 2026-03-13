import { Solution } from "../model/solutionModel.js";

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
