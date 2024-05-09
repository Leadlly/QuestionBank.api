import express from "express";
import { createSubtopic, getNestedSubtopicsByName, getSubtopics } from "../controller/subtopicController.js";
import convertToLowercase from "../middlewares/lowercase.js";
import isAuthenticated from "../middlewares/auth.js";
import checkAdmin from "../middlewares/checkAdmin.js";
const router = express.Router();

router.post(
    "/create/subtopic", 
    convertToLowercase, 
    isAuthenticated, 
    checkAdmin,
    createSubtopic
);
router.get("/get/subtopic", isAuthenticated, getSubtopics);
router.get('/nestedsubtopic', getNestedSubtopicsByName);

export default router;