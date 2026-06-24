import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, MODELS } from "../bedrock.js";
import { Subtopic } from "../../model/subtopicModel.js";
import mongoose from "mongoose";

/**
 * Given a list of generated question objects and a set of topic IDs,
 * fetches all subtopics under those topics and uses Claude to assign each
 * question to its best-matching subtopic.
 *
 * Returns a Map<questionIndex → { subtopicId, subtopicName }>
 * for questions where a confident match was found.
 *
 * @param {Array<{question: string, options: Array}>} questions
 * @param {string[]} topicIds     — MongoDB ObjectId strings
 * @returns {Promise<Map<number, {subtopicId: string, subtopicName: string}>>}
 */
export async function assignQuestionsToSubtopics(questions, topicIds) {
  if (!topicIds || topicIds.length === 0 || !questions || questions.length === 0) {
    return new Map();
  }

  // 1. Fetch all subtopics under the given topics
  const objectIds = topicIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const subtopics = await Subtopic.find(
    { topicId: { $in: objectIds } },
    { _id: 1, name: 1, topicId: 1 }
  ).lean();

  if (subtopics.length === 0) {
    console.log("[assignSubtopics] No subtopics found for topics:", topicIds);
    return new Map();
  }

  // 2. Build a compact subtopic list for the prompt
  const subtopicList = subtopics.map((s) => s.name);

  // 3. Build the questions summary (just the question text — no need for full options)
  const questionLines = questions
    .map((q, i) => `${i}: ${q.question.replace(/<[^>]*>/g, "").slice(0, 200)}`)
    .join("\n");

  const userMessage = `You are a curriculum classifier. Assign each question to the most relevant subtopic from the provided list.

AVAILABLE SUBTOPICS:
${subtopicList.map((name, i) => `${i}. ${name}`).join("\n")}

QUESTIONS (index: text):
${questionLines}

RULES:
- Return ONLY a valid JSON object mapping question index (string) to subtopic name (string).
- Use EXACTLY the subtopic name as it appears in the list above.
- If no subtopic is a reasonable fit for a question, use null for that index.
- Do not add explanations or markdown. Return raw JSON only.

Example output:
{"0": "Newton's Laws", "1": "Projectile Motion", "2": null}`;

  try {
    const command = new ConverseCommand({
      modelId: MODELS.DEFAULT,
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.1 },
    });

    const response = await bedrockClient.send(command);
    const rawText = response?.output?.message?.content?.[0]?.text?.trim() ?? "{}";

    // Strip possible markdown fences
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const assignment = JSON.parse(cleaned);

    // Build a name→subtopic lookup for fast resolution
    const subtopicByName = new Map(
      subtopics.map((s) => [s.name.toLowerCase(), s])
    );

    const result = new Map();
    for (const [indexStr, assignedName] of Object.entries(assignment)) {
      if (!assignedName) continue;
      const idx = parseInt(indexStr, 10);
      if (isNaN(idx)) continue;

      const match = subtopicByName.get(assignedName.toLowerCase());
      if (match) {
        result.set(idx, {
          subtopicId: match._id.toString(),
          subtopicName: match.name,
        });
      }
    }

    console.log(`[assignSubtopics] Assigned ${result.size}/${questions.length} questions to subtopics.`);
    return result;
  } catch (err) {
    // Non-fatal — log and return empty map so the job continues without subtopic assignment
    console.error("[assignSubtopics] Classification error:", err.message);
    return new Map();
  }
}
