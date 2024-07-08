import express from "express";
import { createTopic, getTopic, getTopicById } from "../controller/topicController.js";
import convertToLowercase from "../middlewares/lowercase.js";
import isAuthenticated from "../middlewares/auth.js";
import checkAdmin from "../middlewares/checkAdmin.js";
import { updateTopicExamTags } from "../controller/chapterController.js";
const router = express.Router();

router.post(
    "/create/topic", 
    convertToLowercase, 
    isAuthenticated, 
    checkAdmin,
    createTopic
);
router.get("/get/topic", getTopic);
router.get("/get/topic/:id", getTopicById);
router.post("/topic/:id/examtag", updateTopicExamTags);

export default router;