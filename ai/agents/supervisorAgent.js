import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, MODELS } from "../bedrock.js";
import { supervisorPrompt } from "../prompts/index.js";
import { mergePrompts } from "../lib/mergePrompts.js";
import { runSegregationAgent } from "./segregationAgent.js";
import { runQuestionAgent } from "./questionAgent.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Supervisor system prompt (defined in ai/prompts/supervisorPrompt.js)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Supervisor tool definitions
//  (The supervisor's "tools" are the sub-agents themselves)
// ─────────────────────────────────────────────────────────────────────────────
const supervisorTools = [
  {
    toolSpec: {
      name: "callSegregationAgent",
      description:
        "Delegate a task to the Segregation Agent which manages Subjects, Chapters, Topics, and Subtopics.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description:
                "The specific instruction to pass to the Segregation Agent. Be precise: include subject name, standard, chapter names, etc.",
            },
          },
          required: ["task"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "callQuestionAgent",
      description:
        "Delegate a task to the Question Generator Agent which creates and retrieves questions.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description:
                "The specific instruction to pass to the Question Agent. Include subject, chapter, topic, level, count, etc.",
            },
          },
          required: ["task"],
        },
      },
    },
  },
];

// ───────────────────────────────────────────────────────────────────────────
//  Supervisor sub-agent executor
// ───────────────────────────────────────────────────────────────────────────
// customSystemPrompt is forwarded to sub-agents so priority instructions
// apply at every level of the pipeline, not just the supervisor.
async function dispatchToAgent(toolName, input, customSystemPrompt = "") {
  if (toolName === "callSegregationAgent") {
    const { reply } = await runSegregationAgent(input.task, [], customSystemPrompt);
    return { agent: "segregationAgent", result: reply };
  }
  if (toolName === "callQuestionAgent") {
    const { reply } = await runQuestionAgent(input.task, [], customSystemPrompt);
    return { agent: "questionAgent", result: reply };
  }
  return { error: `Unknown agent: ${toolName}` };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Supervisor agentic loop
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Entry point for the multi-agent system.
 *
 * @param {string} userMessage
 * @param {Array}  history              – conversation history for multi-turn sessions
 * @param {string} [customSystemPrompt] – optional caller-supplied instructions
 *                                        that take priority over the default prompt.
 *                                        Also forwarded to every sub-agent.
 * @returns {Promise<{ reply: string, history: Array }>}
 */
export async function runSupervisor(userMessage, history = [], customSystemPrompt = "") {
  console.log("[Supervisor] Incoming:", userMessage);

  const messages = [
    ...history,
    { role: "user", content: [{ text: userMessage }] },
  ];

  const finalSystemPrompt = mergePrompts(supervisorPrompt, customSystemPrompt);

  while (true) {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODELS.DEFAULT,
        system: [{ text: finalSystemPrompt }],
        messages,
        toolConfig: { tools: supervisorTools },
      })
    );

    const { stopReason, output } = response;
    const assistantMessage = output.message;
    messages.push(assistantMessage);

    if (stopReason === "tool_use") {
      const agentResults = [];

      for (const block of assistantMessage.content) {
        if (block.toolUse) {
          const { toolUseId, name, input } = block.toolUse;
          console.log(`[Supervisor] → Calling ${name} with task: "${input.task}"`);

          // Forward customSystemPrompt so sub-agents also apply priority instructions
          const result = await dispatchToAgent(name, input, customSystemPrompt);
          console.log(`[Supervisor] ← ${name} result:`, result.result?.slice(0, 200));

          agentResults.push({
            toolUseId,
            content: [{ json: result }],
          });
        }
      }

      messages.push({
        role: "user",
        content: agentResults.map((r) => ({ toolResult: r })),
      });

      continue;
    }

    if (stopReason === "end_turn") {
      const textBlock = assistantMessage.content.find((b) => b.text);
      return { reply: textBlock ? textBlock.text : "Done.", history: messages };
    }

    return { reply: `Supervisor stopped. Reason: ${stopReason}`, history: messages };
  }
}
