import express from "express";

import isAuthenticated from "../middlewares/auth.js";
import checkAdmin from "../middlewares/checkAdmin.js";
import { createChapter, getChapter } from "../controller/chapterController.js";
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

export default router;