
import express from "express";
import { createTopic, deleteTopic, deleteTopicnullquestion, editTopic, getTopic, getTopicById, getTopicByIds, updateTopic, updateTopicExamTags, updateTopicNumber } from "../controller/topicController.js";
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
router.get("/get/topic/:id",  getTopicById);
router.post("/get/topics",  getTopicByIds);
router.put("/topic/:id/examtag", convertToLowercase, updateTopicExamTags);
router.put("/edit/topic/:id", convertToLowercase, editTopic);
router.delete("/delete/topic/:id", deleteTopic)
router.put("/update/topic/:id", convertToLowercase, updateTopic)
router.delete("/delete/null/topic/:id", deleteTopicnullquestion)
router.post("/update/topicnumber", updateTopicNumber)



export default router;