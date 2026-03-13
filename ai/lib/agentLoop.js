import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient } from "../bedrock.js";

/**
 * Generic agentic loop used by every specialist agent.
 * 
 * @param {object} opts
 * @param {string}   opts.modelId       - Bedrock model ID
 * @param {string}   opts.systemPrompt  - Agent's persona / instructions
 * @param {Array}    opts.tools         - Bedrock toolConfig.tools array
 * @param {object}   opts.toolHandlers  - { toolName: asyncFunction }
 * @param {Array}    opts.messages      - Conversation so far (mutated in place)
 * @returns {Promise<string>}           - Final text reply from the agent
 */
export async function agentLoop({ modelId, systemPrompt, tools, toolHandlers, messages }) {
  while (true) {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt }],
        messages,
        toolConfig: { tools },
      })
    );

    const { stopReason, output } = response;
    const assistantMessage = output.message;
    messages.push(assistantMessage);

    // ── The model wants to call one or more tools
    if (stopReason === "tool_use") {
      const toolResults = [];

      for (const block of assistantMessage.content) {
        if (block.toolUse) {
          const { toolUseId, name, input } = block.toolUse;
          const handler = toolHandlers[name];

          let result;
          if (!handler) {
            result = { success: false, error: `Tool '${name}' is not registered for this agent.` };
          } else {
            console.log(`  [tool:${name}]`, JSON.stringify(input));
            result = await handler(input);
            console.log(`  [tool:${name}] →`, JSON.stringify(result).slice(0, 200));
          }

          toolResults.push({ toolUseId, content: [{ json: result }] });
        }
      }

      // Return tool results to the model
      messages.push({
        role: "user",
        content: toolResults.map((r) => ({ toolResult: r })),
      });

      continue; // next loop iteration
    }

    // ── The model is done
    if (stopReason === "end_turn") {
      const textBlock = assistantMessage.content.find((b) => b.text);
      return textBlock ? textBlock.text : "Done.";
    }

    // max_tokens / content_filtered / etc.
    return `Agent stopped. Reason: ${stopReason}`;
  }
}
