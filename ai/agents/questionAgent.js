import {
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, MODELS as BEDROCK_MODELS } from "../bedrock.js";
import { createVertexClient, GEMINI_MODELS } from "../gemini.js";
import { questionPrompt } from "../prompts/index.js";
import { mergePrompts } from "../lib/mergePrompts.js";

// ─── Shared JSON cleaner ──────────────────────────────────────────────────────

/**
 * Strip markdown code fences and parse the JSON array from a raw LLM response.
 * Returns an empty array if parsing fails.
 */
function parseQuestionsFromText(rawText) {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[QuestionAgent] JSON parse failed:", err.message);
    console.error("[QuestionAgent] Raw text snippet:", rawText.slice(0, 400));
    return [];
  }
}

// ─── Gemini / Vertex AI runner ────────────────────────────────────────────────

async function runWithGemini(userMessage, systemPrompt) {
  console.log("[QuestionAgent:Gemini] model:", GEMINI_MODELS.DEFAULT);

  const ai = createVertexClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.DEFAULT,
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  });

  return String(response?.text ?? "[]").trim();
}

// ─── Bedrock / Claude runner (non-streaming) ──────────────────────────────────

async function runWithBedrock(userMessage, systemPrompt) {
  console.log("[QuestionAgent:Bedrock] model:", BEDROCK_MODELS.DEFAULT);

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODELS.DEFAULT,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestBody),
  });

  const response = await bedrockClient.send(command);
  const rawBody = Buffer.from(response.body).toString("utf-8");
  const parsed = JSON.parse(rawBody);

  return parsed?.content?.[0]?.text?.trim() ?? "[]";
}

// ─── Bedrock streaming runner ─────────────────────────────────────────────────

/**
 * Stream tokens from Bedrock Claude via InvokeModelWithResponseStreamCommand.
 * Calls `onToken(delta)` for each text chunk, returns the full accumulated text.
 *
 * @param {string}   userMessage
 * @param {string}   systemPrompt
 * @param {Function} onToken - called with each text delta as it arrives
 */
export async function streamWithBedrock(userMessage, systemPrompt, onToken) {
  console.log("[QuestionAgent:BedrockStream] model:", BEDROCK_MODELS.DEFAULT);

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: BEDROCK_MODELS.DEFAULT,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestBody),
  });

  const response = await bedrockClient.send(command);
  let fullText = "";

  for await (const event of response.body) {
    if (!event?.chunk?.bytes) continue;

    const chunkJson = JSON.parse(
      Buffer.from(event.chunk.bytes).toString("utf-8")
    );

    // Claude streaming event types: content_block_delta carries text deltas
    if (chunkJson.type === "content_block_delta" && chunkJson.delta?.type === "text_delta") {
      const delta = chunkJson.delta.text ?? "";
      fullText += delta;
      if (onToken) onToken(delta);
    }
  }

  return fullText;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the Question Generator Agent (non-streaming).
 */
export async function runQuestionAgent(
  userMessage,
  history = [],
  customSystemPrompt = "",
  provider = "bedrock",
) {
  console.log(`[QuestionAgent] provider=${provider} | task:`, userMessage);

  const systemPrompt = mergePrompts(questionPrompt, customSystemPrompt);

  let rawText;

  if (provider === "bedrock") {
    rawText = await runWithBedrock(userMessage, systemPrompt);
  } else {
    rawText = await runWithGemini(userMessage, systemPrompt);
  }

  const questions = parseQuestionsFromText(rawText);

  console.log(`[QuestionAgent] Generated ${questions.length} questions via ${provider}.`);

  return { questions, reply: rawText, history: [] };
}

/**
 * Scan `buffer` for complete JSON objects at the top level of a JSON array.
 * Yields each complete object string one at a time.
 *
 * The LLM streams a JSON array like:
 *   [ {...}, {...}, {...} ]
 *
 * We track brace depth so we can extract each `{...}` the moment it closes,
 * without waiting for the closing `]`.
 *
 * Returns { emitted: parsedQuestion[], remaining: string (unparsed tail) }
 */
function extractCompletedQuestions(buffer) {
  const emitted = [];
  let i = 0;
  const len = buffer.length;

  while (i < len) {
    // Skip whitespace, commas, and the outer array brackets
    if (buffer[i] === " " || buffer[i] === "\n" || buffer[i] === "\r" ||
        buffer[i] === "\t" || buffer[i] === "," ||
        buffer[i] === "[" || buffer[i] === "]") {
      i++;
      continue;
    }

    if (buffer[i] !== "{") {
      i++;
      continue;
    }

    // Found start of a JSON object — scan forward to find its matching `}`
    let depth = 0;
    let inString = false;
    let escape = false;
    let j = i;

    while (j < len) {
      const ch = buffer[j];

      if (escape) {
        escape = false;
      } else if (ch === "\\" && inString) {
        escape = true;
      } else if (ch === '"') {
        inString = !inString;
      } else if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      j++;
    }

    if (depth !== 0) {
      // Object is not complete yet — stop and return the remainder
      break;
    }

    const objectStr = buffer.slice(i, j + 1);
    try {
      const parsed = JSON.parse(objectStr);
      emitted.push(parsed);
    } catch {
      // malformed partial — skip ahead one char and retry
      i++;
      continue;
    }

    i = j + 1;
  }

  return { emitted, remaining: buffer.slice(i) };
}

/**
 * Run the Question Generator Agent with SSE streaming (Bedrock only).
 *
 * SSE event contract (frontend):
 *   event: question  → data: { index: number, question: {...} }   (one per question, as soon as it's parsed)
 *   event: done      → data: { total: number }                     (no payload — saves bandwidth)
 *   event: error     → data: { message: string }
 *
 * @param {string}        userMessage
 * @param {string}        customSystemPrompt  Already-merged prompt from the controller
 * @param {import('express').Response} res
 */
export async function streamQuestionAgent(userMessage, customSystemPrompt, res) {
  console.log("[QuestionAgent:Stream] Starting SSE stream...");

  const systemPrompt = mergePrompts(questionPrompt, customSystemPrompt);

  // SSE headers — must be set before any writes
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Tell Vercel / proxies not to buffer this response
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // res.flush is available when compression middleware is present
    if (typeof res.flush === "function") res.flush();
  };

  try {
    let buffer = "";
    let questionIndex = 0;

    await streamWithBedrock(userMessage, systemPrompt, (delta) => {
      buffer += delta;

      // Try to extract any fully-formed question objects from the running buffer
      const { emitted, remaining } = extractCompletedQuestions(buffer);
      buffer = remaining;

      for (const question of emitted) {
        sendEvent("question", { index: questionIndex, question });
        questionIndex++;
      }
    });

    // Drain any leftover in buffer (handles edge cases like no trailing comma)
    if (buffer.trim()) {
      const { emitted } = extractCompletedQuestions(buffer + "]");
      for (const question of emitted) {
        sendEvent("question", { index: questionIndex, question });
        questionIndex++;
      }
    }

    console.log(`[QuestionAgent:Stream] Done — ${questionIndex} questions emitted.`);

    // Final event: just the total count, no payload to blow up response size
    sendEvent("done", { total: questionIndex });
  } catch (err) {
    console.error("[QuestionAgent:Stream] Error:", err);
    sendEvent("error", { message: err.message || "Stream failed" });
  } finally {
    res.end();
  }
}
