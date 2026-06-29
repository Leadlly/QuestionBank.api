/**
 * api/agent/generate-async.js
 *
 * Dedicated Vercel serverless function for the async question-generation endpoint.
 *
 * Why a separate file instead of routing through api/index.js?
 * ─────────────────────────────────────────────────────────────
 * Vercel freezes (and eventually kills) a serverless function the moment the
 * HTTP response is sent. A plain fire-and-forget Promise would be killed
 * before the background work ever completes.
 *
 * The fix:
 *   1. Use `waitUntil()` from @vercel/functions — this tells Vercel to keep
 *      the function execution context alive until the supplied Promise settles,
 *      even though the HTTP response has already been sent.
 *   2. maxDuration=60 (Hobby plan limit). Raise to 300 on Vercel Pro if needed.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: "./.env" });

import { waitUntil } from "@vercel/functions";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import isAuthenticated from "../../middlewares/auth.js";
import checkAiAccess from "../../middlewares/checkAiAccess.js";
import connectedToDb from "../../db/db.js";
import { generateAsync } from "../../controllers/agentController.js";
import dbModeMiddleware from "../../middlewares/dbModeMiddleware.js";

// Ensure DB is connected in this isolated function context
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

/**
 * Wrap generateAsync so the background job promise is handed to waitUntil.
 *
 * generateAsync internally calls:
 *   runGenerationJob(...).catch(...)
 *
 * We intercept that via a req-scoped holder so waitUntil can register it
 * BEFORE the response is flushed. The controller sets req._backgroundJob
 * to the promise it fires off.
 */
app.post("*", isAuthenticated, checkAiAccess, async (req, res) => {
  // Inject a hook so the controller can register its background promise
  let backgroundJob = null;
  req._registerBackgroundJob = (promise) => {
    backgroundJob = promise;
  };

  await generateAsync(req, res);

  // If the controller registered a background job, keep the function alive
  if (backgroundJob) {
    waitUntil(backgroundJob);
  }
});

export default app;

// ── Vercel function config ────────────────────────────────────────────────────
export const config = {
  api: {
    responseLimit: false,
  },
};

// maxDuration is set in vercel.json (60s on Hobby, 300s on Pro)
