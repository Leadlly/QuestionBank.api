import express from "express";
import { getMode, setMode } from "../controllers/dbModeController.js";
import isAuthenticated from "../middlewares/auth.js";
import checkAdmin from "../middlewares/checkAdmin.js";

const router = express.Router();

// Anyone logged-in can read the current mode
router.get("/db/mode", isAuthenticated, getMode);

// Only admins can switch the mode
router.post("/db/mode", isAuthenticated, checkAdmin, setMode);

export default router;
