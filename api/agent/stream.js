import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: "./.env" });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { streamAgent } from "../../controllers/agentController.js";
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

app.post("*", isAuthenticated, checkAiAccess, streamAgent);

export default app;

// Tell Vercel not to buffer the streaming response body.
// Without this, the platform waits for the function to finish before
// forwarding bytes to the client, defeating the purpose of SSE.
export const config = {
  api: {
    responseLimit: false,
  },
};
