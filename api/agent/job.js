/**
 * api/agent/job.js
 *
 * Dedicated Vercel serverless function for the job-status polling endpoint.
 * GET /api/agent/job/:jobId
 *
 * Routes through api/index.js would work too, but having this as a separate
 * file makes maxDuration explicit and keeps it decoupled from the catch-all.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: "./.env" });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import isAuthenticated from "../../middlewares/auth.js";
import checkAiAccess from "../../middlewares/checkAiAccess.js";
import connectedToDb from "../../db/db.js";
import { getJobStatus } from "../../controllers/agentController.js";
import dbModeMiddleware from "../../middlewares/dbModeMiddleware.js";

connectedToDb();

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
app.use(dbModeMiddleware);

// Vercel rewrites /api/agent/job/:jobId → this file; jobId arrives as a query param
// because Vercel file-based routing doesn't support path params directly.
// We normalise it back into req.params so the controller works unchanged.
app.get("*", isAuthenticated, checkAiAccess, (req, res, next) => {
  const jobId = req.query.jobId || req.path.split("/").filter(Boolean).pop();
  req.params = { ...req.params, jobId };
  next();
}, getJobStatus);

export default app;

export const config = {
  api: {
    responseLimit: false,
  },
};
