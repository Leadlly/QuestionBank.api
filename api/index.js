// Catch-all Vercel function — forwards every request to the full Express app.
// All routes except /api/agent/run and /api/agent/stream are handled here.
import app from "../app.js";

export default app;
