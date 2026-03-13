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
 * Run the Question Generator Agent with SSE streaming (Bedrock only).
 * Writes Server-Sent Events to `res` as tokens arrive, then sends a final
 * `event: done` with the parsed questions array.
 *
 * @param {string}        userMessage
 * @param {string}        customSystemPrompt
 * @param {import('express').Response} res - Express response (SSE mode)
 */
export async function streamQuestionAgent(userMessage, customSystemPrompt, res) {
  console.log("[QuestionAgent:Stream] Starting SSE stream...");

  const systemPrompt = mergePrompts(questionPrompt, customSystemPrompt);

  // SSE headers — must be set before any writes
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let fullText = "";

    await streamWithBedrock(userMessage, systemPrompt, (delta) => {
      fullText += delta;
      // Send each token chunk to the client
      sendEvent("token", { delta });
    });

    const questions = parseQuestionsFromText(fullText);
    console.log(`[QuestionAgent:Stream] Done — ${questions.length} questions.`);

    // Final event carries the complete parsed questions array
    sendEvent("done", { questions, reply: fullText });
  } catch (err) {
    console.error("[QuestionAgent:Stream] Error:", err);
    sendEvent("error", { message: err.message || "Stream failed" });
  } finally {
    res.end();
  }
}
