import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * ai/gemini.js
 *
 * Vertex AI–backed Gemini client for the Question Generator Agent.
 *
 * Credential resolution order:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var — if it points to an existing file, use it directly.
 *   2. GOOGLE_CREDENTIALS_JSON_BASE64 env var — decode the base64 service-account JSON and
 *      write it to a temp file, then set GOOGLE_APPLICATION_CREDENTIALS to that path.
 *
 * This handles both Docker deployments (where the file is volume-mounted) and local
 * development (where the base64 value is used directly from .env).
 */

function setupCredentials() {
  const existingPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (existingPath && fs.existsSync(existingPath)) {
    console.log("[Gemini] Using credentials file:", existingPath);
    return;
  }

  const b64 = process.env.GOOGLE_CREDENTIALS_JSON_BASE64;
  if (!b64) {
    console.warn("[Gemini] Neither GOOGLE_APPLICATION_CREDENTIALS nor GOOGLE_CREDENTIALS_JSON_BASE64 is set. Vertex AI calls will fail.");
    return;
  }

  try {
    const json = Buffer.from(b64, "base64").toString("utf-8");
    const tempPath = path.join(os.tmpdir(), "qb-google-credentials.json");
    fs.writeFileSync(tempPath, json, { encoding: "utf-8" });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempPath;
    console.log("[Gemini] Service-account credentials decoded and written to:", tempPath);
  } catch (err) {
    console.error("[Gemini] Failed to decode GOOGLE_CREDENTIALS_JSON_BASE64:", err.message);
  }
}

// Run once at module load — must happen before any GoogleGenAI constructor call.
setupCredentials();

/**
 * Create a fresh Vertex AI–backed GoogleGenAI client.
 * Returns a new instance each time (lightweight, stateless).
 */
export function createVertexClient() {
  return new GoogleGenAI({
    vertexai: true,
    project:  process.env.GOOGLE_CLOUD_PROJECT_ID,
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  });
}

/**
 * Available model IDs for Vertex AI Gemini.
 * DEFAULT is used by the Question Agent unless overridden.
 */
export const GEMINI_MODELS = {
  DEFAULT:    "gemini-2.5-pro",       // best quality — used by default
  FLASH:      "gemini-2.0-flash",     // faster, slightly less capable
  FLASH_LITE: "gemini-2.0-flash-lite",// lightest / fastest
};
