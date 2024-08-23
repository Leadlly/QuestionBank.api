import express from "express";
import {
  allUser,
  createQuestion,
  deleteQuestion,
  editQuestion,
  getAllQuestion,
  getMyQuestions,
  getTotalQuestions,
  updateOption,
  updateQuestionDetails,
  // toggleOptionTag,
} from "../controller/quesController.js";
import isAuthenticated from "../middlewares/auth.js";
import convertToLowercase from "../middlewares/lowercase.js";
import checkAdmin from "../middlewares/checkAdmin.js";

const router = express.Router();

router.post(
  "/create/question",
  isAuthenticated,
  createQuestion
);
router.put("/edit/question/:id", isAuthenticated, convertToLowercase, editQuestion)
router.put("/edit/question/:id/option/:optionId", isAuthenticated, convertToLowercase, updateOption)
router.delete("/delete/:id", isAuthenticated, deleteQuestion);

router.get("/get/question", isAuthenticated, getAllQuestion);
router.get("/get/myquestion", isAuthenticated, getMyQuestions)
router.get("/get/users", isAuthenticated, allUser);
router.get("/get/totalquestion", isAuthenticated, getTotalQuestions);
router.put('/updatequestion/:questionId', updateQuestionDetails);

export default router;
