import { config } from "dotenv";
config({ path: "./.env" });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { runAgent } from "../../controllers/agentController.js";
import isAuthenticated from "../../middlewares/auth.js";
import checkAiAccess from "../../middlewares/checkAiAccess.js";

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origin.match(/^https?:\/\/(.*\.)?vercel\.app$/) || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.post("*", isAuthenticated, checkAiAccess, runAgent);

export default app;
