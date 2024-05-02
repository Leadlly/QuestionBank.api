import express from "express";
import {
  createQuestion,
  deleteQuestion,
  getAllQuestion,
} from "../controller/quesController.js";
import isAuthenticated from "../middlewares/auth.js";
import convertToLowercase from "../middlewares/lowercase.js";
import checkAdmin from "../middlewares/checkAdmin.js";

const router = express.Router();

router.post(
  "/create/question",
  convertToLowercase,
  isAuthenticated,
  createQuestion
);

router.delete("/delete/:id", isAuthenticated, deleteQuestion);

router.get("/get/question", isAuthenticated, checkAdmin, getAllQuestion);

export default router;
