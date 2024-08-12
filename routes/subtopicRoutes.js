import express from "express";
import { createSubtopic, deleteSubtopic, getNestedSubtopicsByName, getSubtopics, updateSubtopic } from "../controller/subtopicController.js";
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
router.get("/get/subtopic",  getSubtopics);
router.get('/nestedsubtopic', getNestedSubtopicsByName);
router.put('/update/subtopic/:id', convertToLowercase, updateSubtopic)
router.delete('/delete/subtopic/:id', deleteSubtopic)

export default router;