/**
 * ai/prompts/index.js  –  Barrel export for all agent system prompts.
 *
 * Import from here:
 *   import { supervisorPrompt, segregationPrompt, questionPrompt } from "../prompts/index.js";
 *   import { getLevelPrompt } from "../prompts/index.js";
 */
export { supervisorPrompt } from "./supervisorPrompt.js";
export { segregationPrompt } from "./segregationPrompt.js";
export { questionPrompt } from "./questionPrompt.js";
export { getLevelPrompt } from "./levelPrompts.js";
export { solutionPrompt } from "./solutionPrompt.js";
