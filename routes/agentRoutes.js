import express from "express";
import { runAgent, streamAgent, chat, segregate, generateQuestions, filterForRelocation, generateAsync, getJobStatus } from "../controllers/agentController.js";
import isAuthenticated from "../middlewares/auth.js";
import checkAiAccess from "../middlewares/checkAiAccess.js";

const AgentRouter = express.Router();

AgentRouter.post("/agent/run",              isAuthenticated, checkAiAccess, runAgent);
AgentRouter.post("/agent/stream",           isAuthenticated, checkAiAccess, streamAgent);
AgentRouter.post("/agent/chat",             isAuthenticated, checkAiAccess, chat);
AgentRouter.post("/agent/segregate",        isAuthenticated, checkAiAccess, segregate);
AgentRouter.post("/agent/questions",        isAuthenticated, checkAiAccess, generateQuestions);
AgentRouter.post("/agent/filter-relocate",  isAuthenticated, checkAiAccess, filterForRelocation);

// Async background generation — returns immediately with jobId, auto-inserts to DB
AgentRouter.post("/agent/generate-async",   isAuthenticated, checkAiAccess, generateAsync);
AgentRouter.get("/agent/job/:jobId",        isAuthenticated, checkAiAccess, getJobStatus);

export default AgentRouter;
