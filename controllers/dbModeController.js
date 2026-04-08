import { getDbMode, switchDb } from "../db/db.js";

/**
 * GET /api/db/mode
 * Returns the currently active database mode.
 */
export const getMode = (req, res) => {
  res.status(200).json({
    success: true,
    mode: getDbMode(),
    label: getDbMode() === "live" ? "Live (Production)" : "Test (Development)",
  });
};

/**
 * POST /api/db/mode
 * Body: { mode: "test" | "live" }
 * Switches the active database connection. Admin only.
 */
export const setMode = async (req, res) => {
  const { mode } = req.body;

  if (!mode || (mode !== "test" && mode !== "live")) {
    return res.status(400).json({
      success: false,
      message: 'Invalid mode. Must be "test" or "live".',
    });
  }

  try {
    await switchDb(mode);
    res.status(200).json({
      success: true,
      message: `Switched to ${mode} database`,
      mode,
      label: mode === "live" ? "Live (Production)" : "Test (Development)",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to switch database",
    });
  }
};
