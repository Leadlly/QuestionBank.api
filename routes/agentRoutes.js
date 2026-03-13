import express from "express";
import { runAgent, streamAgent, chat, segregate, generateQuestions } from "../controllers/agentController.js";

const AgentRouter = express.Router();

AgentRouter.post("/agent/run",       runAgent);          // standard JSON response
AgentRouter.post("/agent/stream",    streamAgent);       // SSE streaming response
AgentRouter.post("/agent/chat",      chat);              // legacy — supervisor only
AgentRouter.post("/agent/segregate", segregate);         // legacy — segregation agent only
AgentRouter.post("/agent/questions", generateQuestions); // legacy — question agent only

export default AgentRouter;
