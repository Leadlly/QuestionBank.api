import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, MODELS as BEDROCK_MODELS } from "../bedrock.js";
import { solutionPrompt } from "../prompts/index.js";

/**
 * Call Bedrock to generate a worked solution for a single question.
 *
 * @param {string} userMessage  - Full question context built by the controller
 * @returns {Promise<string>}   - Raw text response from the model
 */
export async function runWithBedrock(userMessage) {
  console.log("[SolutionAgent] model:", BEDROCK_MODELS.DEFAULT);

  const response = await bedrockClient.send(new ConverseCommand({
    modelId: BEDROCK_MODELS.DEFAULT,
    system: [{ text: solutionPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 4096 },
  }));

  return (response.output?.message?.content || [])
    .map((block) => block.text || "")
    .join("")
    .trim();
}
