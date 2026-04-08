import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

// ── DB URIs ───────────────────────────────────────────────────────────────────
const TEST_URI = process.env.MONGO_URI;
const LIVE_URI = process.env.MAIN_DATABASE_URL;

// ── In-memory mode (per Vercel function instance) ─────────────────────────────
// The frontend sends an "x-db-mode" header with every request.
// The dbModeMiddleware calls switchDb() so this stays in sync.
let currentMode = "test";

export function getDbMode() {
  return currentMode;
}

/**
 * Switch the active Mongoose connection to the requested mode.
 * Called by dbModeMiddleware on every incoming request.
 * @param {"test"|"live"} mode
 */
export async function switchDb(mode) {
  if (mode !== "test" && mode !== "live") {
    throw new Error(`Invalid db mode "${mode}". Must be "test" or "live".`);
  }

  // Already on the right DB and connection is alive — nothing to do
  if (mode === currentMode && mongoose.connection.readyState === 1) return;

  const uri = mode === "live" ? LIVE_URI : TEST_URI;
  if (!uri) {
    throw new Error(`URI for mode "${mode}" is not set in .env`);
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri, { dbName: "leadllyQuestions" });
  currentMode = mode;
  console.log(`[DB] ✅ Connected to ${mode} database`);
}

// ── Initial connection (always test on cold start) ────────────────────────────
const connectedToDb = async () => {
  try {
    await mongoose.connect(TEST_URI, { dbName: "leadllyQuestions" });
    currentMode = "test";
    console.log("[DB] Connected to test database");
  } catch (error) {
    console.error("[DB] mongo error =========>", error);
  }
};

export default connectedToDb;
