import express from "express";
import { runAgent, chat, segregate, generateQuestions } from "../controllers/agentController.js";

const AgentRouter = express.Router();

AgentRouter.post("/agent/run", runAgent);           // primary — agentType + customSystemPrompt
AgentRouter.post("/agent/chat", chat);              // legacy  — supervisor only
AgentRouter.post("/agent/segregate", segregate);    // legacy  — segregation agent only
AgentRouter.post("/agent/questions", generateQuestions); // legacy — question agent only

export default AgentRouter;
