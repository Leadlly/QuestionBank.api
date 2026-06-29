import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

/**
 * Shared Bedrock client – initialised once, reused by all agents.
 *
 * Credentials are read LAZILY via a provider function so that the client
 * works correctly whether this module is imported by the Express server
 * (which calls dotenv.config() in app.js before any code runs) or by a
 * standalone CLI script (where ESM static imports are hoisted and would
 * otherwise read process.env before dotenv has had a chance to populate it).
 */
export const bedrockClient = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: async () => {
    const accessKeyId     = process.env.AWS_BEDROCK_ACCESS_KEY;
    const secretAccessKey = process.env.AWS_BEDROCK_SECRET_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "AWS Bedrock credentials missing. " +
        "Make sure AWS_BEDROCK_ACCESS_KEY and AWS_BEDROCK_SECRET_KEY are set in .env"
      );
    }
    return { accessKeyId, secretAccessKey };
  },
});

export const MODELS = {
  DEFAULT: "arn:aws:bedrock:us-east-1:471112741644:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0",
};
