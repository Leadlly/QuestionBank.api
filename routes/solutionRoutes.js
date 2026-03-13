import express from "express";
import {
  createSolution,
  getSolution,
  getSolutionsByQuestion,
} from "../controllers/solutionController.js";

const SolutionRouter = express.Router();

SolutionRouter.post("/solution/create",                    createSolution);
SolutionRouter.get("/solution/:id",                        getSolution);
SolutionRouter.get("/solution/question/:questionId",       getSolutionsByQuestion);

export default SolutionRouter;
