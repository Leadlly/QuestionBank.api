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
router.get("/get/chapter", getChapter);
router.get("/get/chapter/:id", getChapterById);
router.put("/chapter/:id/examtag", updateChapterExamTags);

export default router;