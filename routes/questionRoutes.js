import express from "express";
import {
  createQuestion,
  deleteQuestion,
} from "../controller/quesController.js";
import {
  createChapter,
  createSubject,
  createTopic,
  getAllSubject,
  getChapter,
  getTopic,
} from "../controller/subjectController.js";
import isAuthenticated from "../middlewares/auth.js";
// import convertToLowercase from "../middlewares/convertToLowerCase.js";

const router = express.Router();

router.post(
  "/create/question",
  //   convertToLowercase,
  isAuthenticated,
  createQuestion
);
router.post(
  "/create/subject",
  //   convertToLowercase,
  isAuthenticated,
  createSubject
);
router.post(
  "/create/chapter",
  //   convertToLowercase,
  isAuthenticated,
  createChapter
);
router.post(
    "/create/topic", 
    // convertToLowercase, 
    isAuthenticated, 
    createTopic
);
router.delete("/delete/:id", isAuthenticated, deleteQuestion);
router.get("/get/subject", isAuthenticated, getAllSubject);
router.get("/get/chapter", isAuthenticated, getChapter);
router.get("/get/topic", isAuthenticated, getTopic);

export default router;
