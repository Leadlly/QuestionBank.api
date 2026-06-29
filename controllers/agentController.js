import { runSupervisor } from "../ai/agents/supervisorAgent.js";
import { runSegregationAgent } from "../ai/agents/segregationAgent.js";
import { runQuestionAgent, streamQuestionAgent, streamWithBedrock } from "../ai/agents/questionAgent.js";
import { runRelocationAgent } from "../ai/agents/relocationAgent.js";
import { runReviewerAgent } from "../ai/agents/reviewerAgent.js";
import { getLevelPrompt, solutionPrompt, questionPrompt } from "../ai/prompts/index.js";
import { mergePrompts } from "../ai/lib/mergePrompts.js";
import { assignQuestionsToSubtopics } from "../ai/lib/assignSubtopics.js";
import { Ques } from "../model/quesModel.js";
import { Solution } from "../model/solutionModel.js";
import { User } from "../model/userModel.js";
import { GenerationJob } from "../model/generationJobModel.js";
import mongoose from "mongoose";

const VALID_AGENT_TYPES = ["supervisor", "segregation", "question"];

// ─────────────────────────────────────────────────────────────────────────────
//  Shared helper — builds the merged system-prompt for the question agent.
//  Used by both runAgent and streamAgent so the logic stays DRY.
// ─────────────────────────────────────────────────────────────────────────────
function buildQuestionSystemPrompt({ standard, subject, chapter, topic, subtopic, level, includeSolutions, callerPrompt }) {
  const contextLines = [
    `Standard / Class : ${standard}`,
    `Subject          : ${subject}`,
    `Chapter          : ${chapter}`,
    topic    ? `Topic            : ${topic}`    : null,
    subtopic ? `Subtopic         : ${subtopic}` : null,
    level    ? `Level            : ${level}`    : null,
  ].filter(Boolean);

  const sessionContext = [
    "SESSION CONTEXT — generate questions ONLY within this scope:",
    contextLines.join("\n"),
    "",
    "Rules enforced for this session:",
    `- Every question MUST belong to Standard ${standard}, Subject "${subject}", Chapter "${chapter}".`,
    topic    ? `- Questions must be under Topic "${topic}".`    : "- Topic is not specified; cover the chapter broadly.",
    subtopic ? `- Narrow down further to Subtopic "${subtopic}".` : null,
    level
      ? `- ALL questions MUST be at difficulty level "${level}". Do NOT mix difficulty levels.`
      : "- Use default difficulty distribution: 40% Easy, 40% Medium, 20% Hard.",
    "- Do NOT generate questions outside the above scope, even if asked.",
    "- Do NOT save anything to a database. Return ONLY the JSON array.",
    includeSolutions
      ? "- For EVERY question, include a detailed `solution` object (see schema below)."
      : "- Do NOT include a solution field in any question.",
  ].filter((l) => l !== null).join("\n");

  const solutionSchemaBlock = includeSolutions ? solutionPrompt : null;

  const levelPromptBlock = getLevelPrompt(level);

  return [
    sessionContext,
    solutionSchemaBlock,
    levelPromptBlock,
    callerPrompt?.trim() || null,
  ].filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  runAgent  →  POST /api/agent/run
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Unified agent runner.
 *
 * Body:
 *   agentType*          "supervisor" | "segregation" | "question"
 *   message*            The user's task (string)
 *   customSystemPrompt  Optional. Injected with PRIORITY after the default prompt.
 *   history             Optional. Previous turns for multi-turn sessions.
 *
 *   ── Only for agentType === "question" ──────────────────────────────────
 *   standard*           Class / grade number  e.g. 11          (required)
 *   subject*            Subject name          e.g. "Physics"   (required)
 *   chapter*            Chapter name          e.g. "Kinematics"(required)
 *   topic               Topic name            e.g. "Projectile Motion" (optional)
 *   subtopic            Subtopic name         (optional)
 *   level               Difficulty level      e.g. "neet" | "jeemains" (optional)
 *   includeSolutions    Boolean — if true, model also generates a worked solution per question
 *   provider            AI provider: "bedrock" (default) | "gemini" (optional)
 */

export const runAgent = async (req, res) => {
  try {
    const {
      agentType,
      message,
      history = [],
      // question-agent curriculum scope
      standard,
      subject,
      chapter,
      topic,
      subtopic,
      level,
      // Whether to generate a worked solution for each question
      includeSolutions = false,
      // AI provider: "bedrock" (default) | "gemini"
      provider = "bedrock",
    } = req.body;

    let { customSystemPrompt = "" } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    if (!agentType || !VALID_AGENT_TYPES.includes(agentType)) {
      return res.status(400).json({
        success: false,
        message: `agentType is required. Must be one of: ${VALID_AGENT_TYPES.join(", ")}.`,
      });
    }

    // ── Question-agent specific validation & context injection ──────────────
    if (agentType === "question") {
      const missing = [];
      if (!standard) missing.push("standard");
      if (!subject)  missing.push("subject");
      if (!chapter)  missing.push("chapter");

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `For agentType "question", the following fields are required: ${missing.join(", ")}.`,
        });
      }

      customSystemPrompt = buildQuestionSystemPrompt({
        standard, subject, chapter, topic, subtopic, level,
        includeSolutions,
        callerPrompt: customSystemPrompt,
      });
    }

    console.log(`[AgentController] type=${agentType} | provider=${provider} | customPrompt=${!!customSystemPrompt}`);

    let result;

    if (agentType === "supervisor") {
      result = await runSupervisor(message, history, customSystemPrompt);
    } else if (agentType === "segregation") {
      result = await runSegregationAgent(message, history, customSystemPrompt);
    } else if (agentType === "question") {
      result = await runQuestionAgent(message, history, customSystemPrompt, provider);
    }

    const responsePayload = {
      success: true,
      agentType,
      reply: result.reply,
      history: result.history,
    };

    // For the question agent return the structured questions array directly
    if (agentType === "question" && Array.isArray(result.questions)) {
      responsePayload.questions = result.questions;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("[AgentController] runAgent error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  chat  →  POST /api/agent/chat  (Supervisor, legacy)
// ─────────────────────────────────────────────────────────────────────────────
export const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const { reply, history: updatedHistory } = await runSupervisor(message, history);

    return res.status(200).json({ success: true, reply, history: updatedHistory });
  } catch (error) {
    console.error("[AgentController] chat error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  segregate  →  POST /api/agent/segregate
// ─────────────────────────────────────────────────────────────────────────────
export const segregate = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const { reply, history: updatedHistory } = await runSegregationAgent(message, history);

    return res.status(200).json({ success: true, reply, history: updatedHistory });
  } catch (error) {
    console.error("[AgentController] segregate error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  generateQuestions  →  POST /api/agent/questions
// ─────────────────────────────────────────────────────────────────────────────
export const generateQuestions = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const { reply, history: updatedHistory } = await runQuestionAgent(message, history);

    return res.status(200).json({ success: true, reply, history: updatedHistory });
  } catch (error) {
    console.error("[AgentController] generateQuestions error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  streamAgent  →  POST /api/agent/stream
//  Same params as /api/agent/run (agentType must be "question").
//  Responds with Server-Sent Events — keeps connection alive while Bedrock
//  streams tokens, then emits a final `done` event with the parsed questions.
// ─────────────────────────────────────────────────────────────────────────────
export const streamAgent = async (req, res) => {
  try {
    const {
      message,
      standard,
      subject,
      chapter,
      topic,
      subtopic,
      level,
      includeSolutions = false,
      customSystemPrompt: callerPrompt = "",
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const missing = [];
    if (!standard) missing.push("standard");
    if (!subject)  missing.push("subject");
    if (!chapter)  missing.push("chapter");
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Fields required: ${missing.join(", ")}.`,
      });
    }

    const systemPrompt = buildQuestionSystemPrompt({
      standard, subject, chapter, topic, subtopic, level,
      includeSolutions,
      callerPrompt,
    });

    console.log(`[AgentController:Stream] standard=${standard} subject=${subject} chapter=${chapter}`);

    // Delegates SSE setup + streaming + final `done` event to the agent
    await streamQuestionAgent(message, systemPrompt, res);
  } catch (error) {
    console.error("[AgentController] streamAgent error:", error);
    // Headers may already be sent; try to emit an error SSE event
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  filterForRelocation  →  POST /api/agent/filter-relocate
//
//  Body:
//    questionIds* Array of MongoDB _id strings (current page, up to 50)
//    source*      { chapter, topic?, subtopic? }
//    destination* { chapter, topic?, subtopic? }
//
//  Response:
//    { success: true, questionIds: [...] }
// ─────────────────────────────────────────────────────────────────────────────
export const filterForRelocation = async (req, res) => {
  try {
    const { questionIds: incomingIds, source, destination } = req.body;

    if (!Array.isArray(incomingIds) || incomingIds.length === 0) {
      return res.status(400).json({ success: false, message: "questionIds array is required" });
    }
    if (!source?.chapter) {
      return res.status(400).json({ success: false, message: "source.chapter is required" });
    }
    if (!destination?.chapter) {
      return res.status(400).json({ success: false, message: "destination.chapter is required" });
    }

    const docs = await Ques.find({ _id: { $in: incomingIds } }, { _id: 1, question: 1 }).lean();

    if (docs.length === 0) {
      return res.status(400).json({ success: false, message: "No questions found for the given IDs" });
    }

    const questionIds = await runRelocationAgent({ questions: docs, source, destination });

    return res.status(200).json({ success: true, questionIds });
  } catch (error) {
    console.error("[AgentController] filterForRelocation error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  generateAsync  →  POST /api/agent/generate-async
//
//  Fires-and-forgets the AI generation + DB insert pipeline.
//  Returns immediately with { jobId } so the client can poll without hitting
//  Vercel's 60-second serverless timeout.
//
//  Body: same as /api/agent/stream
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract complete JSON objects from a streaming LLM buffer.
 * Identical logic to the one inside questionAgent.js — duplicated here so
 * the background worker has no dependency on the SSE-specific agent module.
 */
function extractCompletedQuestionsFromBuffer(buffer) {
  const emitted = [];
  let i = 0;
  const len = buffer.length;

  while (i < len) {
    if (" \n\r\t,[]\r".includes(buffer[i])) { i++; continue; }
    if (buffer[i] !== "{") { i++; continue; }

    let depth = 0, inString = false, escape = false, j = i;
    while (j < len) {
      const ch = buffer[j];
      if (escape)             { escape = false; }
      else if (ch === "\\" && inString) { escape = true; }
      else if (ch === '"')    { inString = !inString; }
      else if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) break; }
      }
      j++;
    }

    if (depth !== 0) break;

    const objectStr = buffer.slice(i, j + 1);
    try {
      emitted.push(JSON.parse(objectStr));
    } catch { i++; continue; }
    i = j + 1;
  }

  return { emitted, remaining: buffer.slice(i) };
}

/**
 * Background worker — runs OUTSIDE the HTTP request/response cycle.
 *
 * Phase 1: Stream all questions from Bedrock into memory.
 * Phase 2: If autoAssignSubtopics is true, call the AI classifier to map
 *           each question to its best-matching subtopic.
 * Phase 3: Save each question (with proper subtopic) to MongoDB, update job.
 *
 * The job's insertedQuestionIds array is populated incrementally during
 * Phase 3, so the polling endpoint can serve live results.
 */
async function runGenerationJob(job, systemPrompt, message, userId) {
  try {
    await GenerationJob.findByIdAndUpdate(job._id, { status: "generating" });

    // ── Phase 1: collect all generated questions from the Bedrock stream ─────
    let buffer = "";
    const allQuestions = [];

    await streamWithBedrock(message, systemPrompt, (delta) => {
      buffer += delta;
      const { emitted, remaining } = extractCompletedQuestionsFromBuffer(buffer);
      buffer = remaining;
      allQuestions.push(...emitted);
    });

    // Drain any remainder left in the buffer
    if (buffer.trim()) {
      const { emitted } = extractCompletedQuestionsFromBuffer(buffer + "]");
      allQuestions.push(...emitted);
    }

    console.log(`[GenerationJob] ${job._id} — ${allQuestions.length} questions parsed from stream.`);

    // ── Phase 2: AI subtopic assignment (only when topics selected, no explicit subtopics) ──
    // subtopicAssignmentMap: Map<questionIndex → { subtopicId, subtopicName }>
    let subtopicAssignmentMap = new Map();

    if (job.autoAssignSubtopics && job.topicsId && job.topicsId.length > 0) {
      console.log(`[GenerationJob] ${job._id} — auto-assigning subtopics for ${allQuestions.length} questions…`);
      subtopicAssignmentMap = await assignQuestionsToSubtopics(allQuestions, job.topicsId.map(String));
    }

    // ── Phase 3: save each question to MongoDB ────────────────────────────────
    const chaptersIdObjs  = (job.chaptersId  || []).map((id) => new mongoose.Types.ObjectId(id));
    const topicsIdObjs    = (job.topicsId    || []).map((id) => new mongoose.Types.ObjectId(id));
    // base subtopicsId from job (used when user explicitly selected a subtopic)
    const baseSubtopicsId = (job.subtopicsId || []).map((id) => new mongoose.Types.ObjectId(id));
    const baseSubtopicNames = job.subtopicNames || [];

    for (let qi = 0; qi < allQuestions.length; qi++) {
      const q = allQuestions[qi];
      try {
        if (!q.question || !Array.isArray(q.options) || q.options.length === 0) continue;
        const hasCorrect = q.options.some((o) => o.isCorrect === true);
        if (!hasCorrect) continue;

        const existing = await Ques.findOne({
          question: q.question,
          subject: job.subject,
          standard: job.standard,
        });
        if (existing) continue;

        // Determine final subtopic assignment for this question
        let finalSubtopicsId   = baseSubtopicsId;
        let finalSubtopicNames = baseSubtopicNames;

        if (job.autoAssignSubtopics && subtopicAssignmentMap.has(qi)) {
          const assigned = subtopicAssignmentMap.get(qi);
          finalSubtopicsId   = [new mongoose.Types.ObjectId(assigned.subtopicId)];
          finalSubtopicNames = [assigned.subtopicName];
        }

        const newQuestion = new Ques({
          question: q.question,
          options: q.options.map((opt) => ({
            name: opt.name,
            tag: opt.isCorrect ? "Correct" : "Incorrect",
            images: [],
          })),
          standard: job.standard,
          subject:  job.subject,
          chapter:  job.chapterNames  || [],
          topics:   job.topicNames    || [],
          subtopics: finalSubtopicNames,
          chaptersId: chaptersIdObjs,
          topicsId:   topicsIdObjs,
          subtopicsId: finalSubtopicsId,
          level: q.level || job.level || "",
          images: [],
          createdBy: userId,
        });

        await newQuestion.save();
        await User.findByIdAndUpdate(userId, { $push: { questions: newQuestion._id } });

        if (q.solution && q.solution.content) {
          await new Solution({
            questionId: newQuestion._id,
            content: q.solution.content,
            createdBy: userId,
          }).save();
        }

        await GenerationJob.findByIdAndUpdate(job._id, {
          $push: { insertedQuestionIds: newQuestion._id },
          $inc:  { insertedCount: 1 },
        });
      } catch (saveErr) {
        console.error(`[GenerationJob] Failed to save question[${qi}]:`, saveErr.message);
      }
    }

    await GenerationJob.findByIdAndUpdate(job._id, {
      status: "done",
      completedAt: new Date(),
    });

    console.log(`[GenerationJob] ${job._id} done.`);
  } catch (err) {
    console.error("[GenerationJob] Fatal error:", err.message);
    await GenerationJob.findByIdAndUpdate(job._id, {
      status: "failed",
      error: err.message,
      completedAt: new Date(),
    });
  }
}

export const generateAsync = async (req, res) => {
  try {
    const {
      message,
      standard,
      subject,
      chapter,         // comma-separated chapter names string
      topic,
      subtopic,
      level,
      includeSolutions = false,
      customSystemPrompt: callerPrompt = "",
      // Optional: pass IDs so the background worker can populate chaptersId etc.
      chaptersId   = [],
      topicsId     = [],
      subtopicsId  = [],
      chapterNames = [],
      topicNames   = [],
      subtopicNames = [],
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message (string) is required." });
    }

    const missing = [];
    if (!standard) missing.push("standard");
    if (!subject)  missing.push("subject");
    if (!chapter)  missing.push("chapter");
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Fields required: ${missing.join(", ")}.` });
    }

    // Cap at 20 questions per request.
    const countMatch = message.match(/generate\s+(\d+)/i);
    const requested  = countMatch ? parseInt(countMatch[1], 10) : 0;
    if (requested > 20) {
      return res.status(400).json({
        success: false,
        message: "Maximum 20 questions per request.",
      });
    }

    // Build the merged system prompt (identical to what streamAgent + streamQuestionAgent produce)
    const sessionPrompt = buildQuestionSystemPrompt({
      standard, subject, chapter, topic, subtopic, level,
      includeSolutions, callerPrompt,
    });
    // Merge with the base questionPrompt exactly as streamQuestionAgent does
    const systemPrompt = mergePrompts(questionPrompt, sessionPrompt);

    // Persist a job document first
    // autoAssignSubtopics = true when the user selected topic(s) but NO explicit subtopic.
    // In that case the background worker will fetch all subtopics under those topics and
    // use AI to assign each question to its best-matching subtopic.
    const autoAssignSubtopics = (
      Array.isArray(topicsId) && topicsId.length > 0 &&
      (!Array.isArray(subtopicsId) || subtopicsId.length === 0)
    );

    const job = await GenerationJob.create({
      status: "pending",
      standard,
      subject,
      chapter,
      topic:    topic    || null,
      subtopic: subtopic || null,
      level:    level    || null,
      includeSolutions,
      requestedCount: 0,
      autoAssignSubtopics,
      // Store supplementary data needed by the background worker
      chaptersId,
      topicsId,
      subtopicsId,
      chapterNames: Array.isArray(chapterNames) ? chapterNames : [chapter],
      topicNames:   Array.isArray(topicNames)   ? topicNames   : (topic ? [topic] : []),
      subtopicNames:Array.isArray(subtopicNames)? subtopicNames: (subtopic ? [subtopic] : []),
      createdBy: req.user._id,
    });

    // ── Start the background job ──────────────────────────────────────────────
    // On Vercel: the dedicated api/agent/generate-async.js function wrapper
    //   calls req._registerBackgroundJob(promise) and passes it to waitUntil(),
    //   which keeps the serverless execution context alive until the job finishes.
    //
    // On local dev / non-Vercel: falls back to plain fire-and-forget (Node.js
    //   process stays alive so the background work completes normally).
    const jobPromise = runGenerationJob(job.toObject(), systemPrompt, message, req.user._id)
      .catch((err) => console.error("[generateAsync] Unhandled background error:", err.message));

    if (typeof req._registerBackgroundJob === "function") {
      req._registerBackgroundJob(jobPromise);
    }

    console.log(`[AgentController:Async] Job created: ${job._id}`);

    return res.status(200).json({
      success: true,
      jobId: job._id,
      autoAssignSubtopics,
      message: autoAssignSubtopics
        ? "Question generation started. Questions will be auto-assigned to subtopics."
        : "Question generation started. Poll /api/agent/job/:jobId for progress.",
    });
  } catch (error) {
    console.error("[AgentController] generateAsync error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getJobStatus  →  GET /api/agent/job/:jobId
//
//  Returns current job progress including inserted question documents so the
//  frontend can render them as they arrive.
// ─────────────────────────────────────────────────────────────────────────────
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid jobId." });
    }

    const job = await GenerationJob.findById(jobId).lean();

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    // Only the owner can poll their own job
    if (job.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Forbidden." });
    }

    // Fetch the actual question documents that have been inserted so far
    let questions = [];
    if (job.insertedQuestionIds && job.insertedQuestionIds.length > 0) {
      questions = await Ques.find({ _id: { $in: job.insertedQuestionIds } })
        .sort({ createdAt: 1 })
        .lean();

      // Attach solutions if any
      const solutions = await Solution.find({
        questionId: { $in: job.insertedQuestionIds },
      }).lean();

      const solutionMap = {};
      for (const sol of solutions) {
        solutionMap[sol.questionId.toString()] = sol.content;
      }

      questions = questions.map((q) => ({
        ...q,
        solution: solutionMap[q._id.toString()]
          ? { content: solutionMap[q._id.toString()] }
          : null,
      }));
    }

    return res.status(200).json({
      success: true,
      jobId,
      status: job.status,
      insertedCount: job.insertedCount,
      requestedCount: job.requestedCount,
      error: job.error || null,
      questions,
    });
  } catch (error) {
    console.error("[AgentController] getJobStatus error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  reviewQuestions  →  POST /api/agent/review
//
//  Runs the Question Reviewer Agent over the question bank.
//  The job is long-running — responses are streamed as Server-Sent Events so
//  the caller can watch progress in real time.
//
//  Body:
//    subject   string  (optional) — restrict review to one subject
//    standard  number  (optional) — further restrict by class/grade
//
//  SSE events emitted:
//    progress  { reviewed, total, correct, reassigned, idled, errors }
//    done      { success, stats }
//    error     { message }
// ─────────────────────────────────────────────────────────────────────────────
export const reviewQuestions = async (req, res) => {
  const { subject, standard, chapterId } = req.body;

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const emit = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  console.log(
    `[AgentController] reviewQuestions` +
    ` | subject=${subject || "ALL"}` +
    ` | chapterId=${chapterId || "ALL"}` +
    ` | standard=${standard || "ALL"}`
  );

  try {
    const stats = await runReviewerAgent({
      subject:   subject   || undefined,
      standard:  standard !== undefined ? Number(standard) : undefined,
      chapterId: chapterId || undefined,
      onProgress: (progress) => emit("progress", progress),
    });

    emit("done", { success: true, stats });
  } catch (error) {
    console.error("[AgentController] reviewQuestions error:", error);
    emit("error", { message: error.message || "Internal Server Error" });
  } finally {
    res.end();
  }
};
