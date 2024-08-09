import express from "express";

import isAuthenticated from "../middlewares/auth.js";
import checkAdmin from "../middlewares/checkAdmin.js";
import { createChapter, getChapter, getChapterById, updateChapterExamTags } from "../controller/chapterController.js";
import convertToLowercase from "../middlewares/lowercase.js";
const router = express.Router();

router.post(
    "/create/chapter",
    convertToLowercase,
    isAuthenticated,
    checkAdmin,
    createChapter
  );
router.get("/get/chapter", isAuthenticated, getChapter);
router.get("/get/chapter/:id", isAuthenticated, getChapterById);
router.put("/chapter/:id/examtag", isAuthenticated, convertToLowercase, updateChapterExamTags);


export default router;