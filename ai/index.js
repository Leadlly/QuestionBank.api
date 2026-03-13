/**
 * ai/index.js  –  Public API for the Question Bank multi-agent system.
 *
 * Import from here, never directly from individual agent files.
 */
export { runSupervisor } from "./agents/supervisorAgent.js";
export { runSegregationAgent } from "./agents/segregationAgent.js";
export { runQuestionAgent } from "./agents/questionAgent.js";
