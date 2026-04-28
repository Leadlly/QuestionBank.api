import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, MODELS } from "../bedrock.js";
import { relocationPrompt } from "../prompts/relocationPrompt.js";

/**
 * Strip HTML tags and collapse whitespace so the model receives clean text.
 */
function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Ask the AI which questions from a source chapter/topic belong to the destination.
 *
 * @param {object} opts
 * @param {Array<{_id:string, question:string}>} opts.questions  - Current page of questions
 * @param {object} opts.source      - { chapter, topic?, subtopic? }
 * @param {object} opts.destination - { chapter, topic?, subtopic? }
 * @returns {Promise<string[]>}  Array of question _id strings to move
 */
export async function runRelocationAgent({ questions, source, destination }) {
  if (!questions || questions.length === 0) return [];

  // Build a concise question list for the prompt
  const questionList = questions
    .map((q, i) => `${i + 1}. [ID: ${q._id}] ${stripHtml(q.question)}`)
    .join("\n");

  const sourceLine = [
    `Chapter: ${source.chapter}`,
    source.topic    ? `Topic: ${source.topic}`       : null,
    source.subtopic ? `Subtopic: ${source.subtopic}` : null,
  ].filter(Boolean).join(", ");

  const destLine = [
    `Chapter: ${destination.chapter}`,
    destination.topic    ? `Topic: ${destination.topic}`       : null,
    destination.subtopic ? `Subtopic: ${destination.subtopic}` : null,
  ].filter(Boolean).join(", ");

  const userMessage = `
SOURCE (current classification):
  ${sourceLine}

DESTINATION (where to move matching questions):
  ${destLine}

QUESTIONS (${questions.length} total):
${questionList}

Review each question. Return the JSON object with the IDs of questions that should be moved to the DESTINATION.
`.trim();

  console.log(`[RelocationAgent] Reviewing ${questions.length} questions | ${sourceLine} → ${destLine}`);

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: MODELS.DEFAULT,
      system: [{ text: relocationPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
    })
  );

  const textBlock = response.output?.message?.content?.find((b) => b.text);
  const rawText = textBlock?.text || "{}";

  console.log(`[RelocationAgent] Raw response: ${rawText.slice(0, 300)}`);

  try {
    // Robustly parse JSON even if the model wraps it in backtick fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    const ids = Array.isArray(parsed.questionIds) ? parsed.questionIds : [];
    console.log(`[RelocationAgent] Suggested ${ids.length} questions for relocation`);
    return ids;
  } catch (err) {
    console.error("[RelocationAgent] Failed to parse response:", err.message);
    return [];
  }
}
