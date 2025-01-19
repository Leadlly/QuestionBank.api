import express from "express";

import isAuthenticated from "../middlewares/auth.js";
import checkAdmin from "../middlewares/checkAdmin.js";
import { chapterNumberUpdate, createChapter, deleteChapter, getChapter, getChapterById, getChaptersByIds, updateChapter, updateChapterExamTags } from "../controller/chapterController.js";
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
router.post("/get/chapters", getChaptersByIds);
router.put("/chapter/:id/examtag", convertToLowercase, updateChapterExamTags);
router.put("/update/chapter/:id", convertToLowercase, updateChapter);
router.delete("/delete/chapter/:id", deleteChapter);
router.post("/update/chapternumber", chapterNumberUpdate)


export default router;