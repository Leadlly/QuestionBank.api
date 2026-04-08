import { switchDb, getDbMode } from "../db/db.js";

/**
 * Reads the "x-db-mode" header sent by the frontend on every request.
 * If the requested mode differs from the current connection, switches the DB.
 *
 * This makes the backend stateless with respect to DB mode — the frontend
 * (localStorage) is the single source of truth, which works correctly on
 * Vercel serverless where in-memory state resets between cold starts.
 */
const dbModeMiddleware = async (req, res, next) => {
  const requestedMode = req.headers["x-db-mode"];

  if (requestedMode === "test" || requestedMode === "live") {
    if (requestedMode !== getDbMode()) {
      try {
        await switchDb(requestedMode);
      } catch (err) {
        console.error("[DB] Failed to switch mode:", err.message);
        // Don't block the request — proceed with current connection
      }
    }
  }

  next();
};

export default dbModeMiddleware;
