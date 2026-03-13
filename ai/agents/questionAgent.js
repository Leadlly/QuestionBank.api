import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
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

// ─── Gemini / Vertex AI runner (DEFAULT) ─────────────────────────────────────

/**
 * Generate questions using Google Gemini via Vertex AI.
 * Uses responseMimeType "application/json" so the model returns valid JSON directly.
 */
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

// ─── Bedrock / Claude runner ──────────────────────────────────────────────────

/**
 * Generate questions using AWS Bedrock (Anthropic Claude via inference profile).
 * Uses InvokeModelCommand with the raw Claude Messages API to avoid the SDK's
 * internal structuredClone serialisation bug.
 */
async function runWithBedrock(userMessage, systemPrompt) {
  console.log("[QuestionAgent:Bedrock] model:", BEDROCK_MODELS.DEFAULT);

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: "user", content: userMessage },
    ],
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the Question Generator Agent.
 *
 * @param {string} userMessage          - The generation request message.
 * @param {Array}  history              - Unused, kept for API compatibility.
 * @param {string} [customSystemPrompt] - SESSION CONTEXT injected by agentController.
 * @param {string} [provider]           - "gemini" (default) | "bedrock"
 * @returns {Promise<{ questions: Array, reply: string, history: Array }>}
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
