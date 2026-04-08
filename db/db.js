import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: "./.env" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODE_FILE = path.join(__dirname, ".db-mode");   // tiny file: "test" or "live"

// ── DB URIs ───────────────────────────────────────────────────────────────────
const TEST_URI = process.env.MONGO_URI;           // test / dev database
const LIVE_URI = process.env.MAIN_DATABASE_URL;   // production database

// ── Persist / load mode from disk so server restarts remember the choice ──────
function loadPersistedMode() {
  try {
    const saved = fs.readFileSync(MODE_FILE, "utf8").trim();
    if (saved === "live" || saved === "test") return saved;
  } catch {
    // file doesn't exist yet → default to "test"
  }
  return "test";
}

function persistMode(mode) {
  try { fs.writeFileSync(MODE_FILE, mode, "utf8"); } catch { /* ignore */ }
}

let currentMode = loadPersistedMode();

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
  persistMode(mode);    // save to disk — survives server restarts
  console.log(`[DB] ✅ Connected to ${mode} database`);
}

// ── Initial connection — uses persisted mode ──────────────────────────────────
const connectedToDb = async () => {
  const mode = loadPersistedMode();
  const uri  = mode === "live" ? LIVE_URI : TEST_URI;

  if (!uri) {
    console.error("[DB] DB URI is not set — cannot connect.");
    return;
  }
  try {
    await mongoose.connect(uri, { dbName: "leadllyQuestions" });
    currentMode = mode;
    console.log(`[DB] Connected to ${mode} database`);
  } catch (error) {
    console.error("[DB] mongo error =========>", error);
  }
};

export default connectedToDb;
