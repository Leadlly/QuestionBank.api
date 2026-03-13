import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

/**
 * Shared Bedrock client – initialised once, reused by all agents.
 * Reads credentials from env vars loaded by dotenv in app.js.
 */
export const bedrockClient = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_BEDROCK_ACCESS_KEY,
    secretAccessKey: process.env.AWS_BEDROCK_SECRET_KEY,
  },
});

export const MODELS = {
  DEFAULT: "arn:aws:bedrock:us-east-1:471112741644:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0",
};
