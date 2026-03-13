/**
 * @deprecated  Import from `./index.js` instead.
 * This file is kept for backward compatibility.
 *
 * The agent has been refactored into a multi-agent system:
 *   ai/agents/supervisorAgent.js   – routes to the right specialist
 *   ai/agents/segregationAgent.js  – manages Subject/Chapter/Topic/Subtopic
 *   ai/agents/questionAgent.js     – generates & saves questions
 */
export { runSupervisor as runAgent } from "./agents/supervisorAgent.js";
