import express from "express";
import {
  getMyProfile,
  login,
  logout,
  register,
  verification,
} from "../controller/userController.js";
import isAuthenticated from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/verify/:id", isAuthenticated, verification);
router.get("/profile", isAuthenticated, getMyProfile);
router.get("/logout", logout);

export default router;
