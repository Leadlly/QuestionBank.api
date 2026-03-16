import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, MODELS as BEDROCK_MODELS } from "../bedrock.js";
import { solutionPrompt } from "../prompts/index.js";

/**
 * Call Bedrock (Claude) to generate a worked solution for a single question.
 *
 * @param {string} userMessage  - Full question context built by the controller
 * @returns {Promise<string>}   - Raw text response from the model
 */
export async function runWithBedrock(userMessage) {
  console.log("[SolutionAgent] model:", BEDROCK_MODELS.DEFAULT);

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    system: solutionPrompt,
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

  return parsed?.content?.[0]?.text?.trim() ?? "";
}
