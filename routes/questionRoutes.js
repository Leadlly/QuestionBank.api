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
router.put("/edit/question/:id", convertToLowercase, editQuestion)
router.put("/edit/question/:id/option/:optionId", convertToLowercase, updateOption)
router.delete("/delete/:id", deleteQuestion);

router.get("/get/question", getAllQuestion);
router.get("/get/myquestion", getMyQuestions )
router.get("/get/users", allUser);
router.get("/get/totalquestion", getTotalQuestions);


export default router;
