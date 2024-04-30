import express from "express";
import {
  createSubject,
  getAllSubject,
} from "../controller/subjectController.js";
import isAuthenticated from "../middlewares/auth.js";
import convertToLowercase from "../middlewares/lowercase.js";
import checkAdmin from "../middlewares/checkAdmin.js";

const router = express.Router();

router.post(
  "/create/subject",
  convertToLowercase,
  isAuthenticated,
  checkAdmin,
  createSubject
);

router.get("/get/subject", isAuthenticated, getAllSubject);



export default router;
