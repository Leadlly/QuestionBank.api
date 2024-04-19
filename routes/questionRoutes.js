import express from "express";
import {
  createQuestion,
  deleteQuestion,
  getAllQuestion,
} from "../controller/quesController.js";
import {
  createChapter,
  createSubTopic,
  createSubject,
  createTopic,
  getAllSubject,
  getChapter,
  getSubTopic,
  getTopic,
} from "../controller/subjectController.js";
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
router.post(
  "/create/subject",
  convertToLowercase,
  isAuthenticated,
  checkAdmin,
  createSubject
);
router.post(
  "/create/chapter",
  convertToLowercase,
  isAuthenticated,
  checkAdmin,
  createChapter
);
router.post(
    "/create/topic", 
    convertToLowercase, 
    isAuthenticated, 
    checkAdmin,
    createTopic
);
router.post(
    "/create/subtopic", 
    convertToLowercase, 
    isAuthenticated, 
    checkAdmin,
    createSubTopic
);
router.delete("/delete/:id", isAuthenticated, deleteQuestion);
router.get("/get/subject", isAuthenticated, getAllSubject);
router.get("/get/chapter", isAuthenticated, getChapter);
router.get("/get/topic", isAuthenticated, getTopic);
router.get("/get/subtopic", isAuthenticated, getSubTopic);
router.get("/get/question", isAuthenticated, checkAdmin, getAllQuestion);


export default router;
