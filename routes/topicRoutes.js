
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
router.get("/get/topic", isAuthenticated, getTopic);
router.get("/get/topic/:id", isAuthenticated,  getTopicById);
router.put("/topic/:id/examtag", isAuthenticated, convertToLowercase, updateTopicExamTags);
router.put("/edit/topic/:id", isAuthenticated, convertToLowercase, editTopic);
router.delete("/delete/topic/:id",isAuthenticated, deleteTopic)
router.put("/update/topic/:id", isAuthenticated, convertToLowercase, updateTopic)
router.delete("/delete/null/topic/:id", isAuthenticated, deleteTopicnullquestion)


export default router;