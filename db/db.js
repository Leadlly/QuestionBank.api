import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

// ── DB URIs ───────────────────────────────────────────────────────────────────
const TEST_URI = process.env.MONGO_URI;           // test / dev database
const LIVE_URI = process.env.MAIN_DATABASE_URL;   // production database

// ── Active mode state ─────────────────────────────────────────────────────────
// "test" → MONGO_URI  |  "live" → MAIN_DATABASE_URL
let currentMode = "test";

export function getDbMode() {
  return currentMode;
}

/**
 * Switch the active Mongoose connection to the given mode.
 * @param {"test"|"live"} mode
 */
export async function switchDb(mode) {
  if (mode !== "test" && mode !== "live") {
    throw new Error(`Invalid db mode "${mode}". Must be "test" or "live".`);
  }
  if (mode === currentMode) {
    console.log(`[DB] Already connected to ${mode} database — no switch needed.`);
    return;
  }

  const uri = mode === "live" ? LIVE_URI : TEST_URI;
  if (!uri) {
    throw new Error(`URI for mode "${mode}" is not set in .env`);
  }

  console.log(`[DB] Switching from "${currentMode}" → "${mode}" …`);

  // Disconnect current connection gracefully
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri, { dbName: "leadllyQuestions" });
  currentMode = mode;
  console.log(`[DB] ✅ Connected to ${mode} database`);
}

// ── Initial connection ────────────────────────────────────────────────────────
const connectedToDb = async () => {
  const uri = TEST_URI;
  if (!uri) {
    console.error("[DB] MONGO_URI is not set — cannot connect.");
    return;
  }
  try {
    await mongoose.connect(uri, { dbName: "leadllyQuestions" });
    currentMode = "test";
    console.log("[DB] Connected to test database");
  } catch (error) {
    console.error("[DB] mongo error =========>", error);
  }
};

export default connectedToDb;
