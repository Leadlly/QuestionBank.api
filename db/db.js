import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

// ── DB URIs ───────────────────────────────────────────────────────────────────
const TEST_URI = process.env.MONGO_URI;
const LIVE_URI = process.env.MAIN_DATABASE_URL;

// ── Config connection — permanently wired to TEST DB ─────────────────────────
// This never switches. It is the source-of-truth for the persisted dbMode
// setting, which survives Vercel cold starts because it lives in MongoDB.
let _configConn = null;

async function getConfigConn() {
  if (_configConn && _configConn.readyState === 1) return _configConn;
  _configConn = mongoose.createConnection(TEST_URI, { dbName: "leadllyQuestions" });
  await _configConn.asPromise();
  return _configConn;
}

async function loadPersistedMode() {
  try {
    const conn = await getConfigConn();
    const doc = await conn.collection("configs").findOne({ key: "dbMode" });
    if (doc && (doc.value === "test" || doc.value === "live")) return doc.value;
  } catch {
    // first run or read error — fall through to default
  }
  return "test";
}

async function persistMode(mode) {
  try {
    const conn = await getConfigConn();
    await conn.collection("configs").updateOne(
      { key: "dbMode" },
      { $set: { key: "dbMode", value: mode } },
      { upsert: true }
    );
  } catch {
    // ignore — mode switch still proceeds
  }
}

// ── Active mode (in-memory, warm within a single Vercel instance) ─────────────
let currentMode = "test";

export function getDbMode() {
  return currentMode;
}

/**
 * Switch the active Mongoose default connection to the given mode.
 * Persists the choice to MongoDB (TEST DB) so Vercel cold starts remember it.
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

  // Persist BEFORE disconnecting — critical when switching to "live" because
  // we are about to leave the test DB and won't be able to write to it after.
  await persistMode(mode);

  console.log(`[DB] Switching from "${currentMode}" → "${mode}" …`);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri, { dbName: "leadllyQuestions" });
  currentMode = mode;
  console.log(`[DB] ✅ Connected to ${mode} database`);
}

// ── Initial connection — reads persisted mode from MongoDB on every cold start ─
const connectedToDb = async () => {
  try {
    const mode = await loadPersistedMode();
    const uri  = mode === "live" ? LIVE_URI : TEST_URI;

    if (!uri) {
      console.error("[DB] DB URI is not set — cannot connect.");
      return;
    }

    await mongoose.connect(uri, { dbName: "leadllyQuestions" });
    currentMode = mode;
    console.log(`[DB] Connected to ${mode} database`);
  } catch (error) {
    console.error("[DB] mongo error =========>", error);
  }
};

export default connectedToDb;
