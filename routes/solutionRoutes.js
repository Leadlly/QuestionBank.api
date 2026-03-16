import express from "express";
import {
  createSolution,
  getSolution,
  getSolutionsByQuestion,
  generateSolution,
  getSolutionBulkStatus,
} from "../controllers/solutionController.js";
import isAuthenticated from "../middlewares/auth.js";
import checkAiAccess from "../middlewares/checkAiAccess.js";

const SolutionRouter = express.Router();

SolutionRouter.post("/solution/create",                    createSolution);
SolutionRouter.get("/solution/bulk-status",                getSolutionBulkStatus);
SolutionRouter.get("/solution/:id",                        getSolution);
SolutionRouter.get("/solution/question/:questionId",       getSolutionsByQuestion);
SolutionRouter.post("/solution/generate/:questionId",      isAuthenticated, checkAiAccess, generateSolution);

export default SolutionRouter;
