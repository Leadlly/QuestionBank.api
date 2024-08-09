
import express from "express";
import { createTopic, deleteTopic, deleteTopicnullquestion, editTopic, getTopic, getTopicById, updateTopic, updateTopicExamTags } from "../controller/topicController.js";
import convertToLowercase from "../middlewares/lowercase.js";
import isAuthenticated from "../middlewares/auth.js";
import checkAdmin from "../middlewares/checkAdmin.js";
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
router.put("/topic/:id/examtag", updateTopicExamTags);
router.put("/edit/topic/:id", editTopic);
router.delete("/delete/topic/:id", deleteTopic)
router.put("/update/topic/:id", updateTopic)
router.delete("/delete/null/topic/:id", deleteTopicnullquestion)


export default router;