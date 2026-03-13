/**
 * ai/lib/mergePrompts.js
 *
 * Merges the default agent system prompt with an optional user-supplied
 * custom prompt.  The custom prompt is appended AFTER the default with a
 * clear "PRIORITY" separator so the LLM understands it should take
 * precedence over any conflicting default instruction.
 */

const SEPARATOR = "═".repeat(58);

/**
 * Merge a default (base) system prompt with an optional custom prompt.
 *
 * Strategy:
 *   - If no customPrompt → return the default as-is.
 *   - If customPrompt exists → append it after the default with a
 *     "PRIORITY INSTRUCTIONS" block. LLMs reliably treat later
 *     instructions as higher priority when they conflict with earlier ones.
 *
 * @param {string}           defaultPrompt  - The agent's built-in prompt.
 * @param {string|undefined} customPrompt   - The caller-supplied additions/overrides.
 * @returns {string}                          The final merged system prompt.
 */
export function mergePrompts(defaultPrompt, customPrompt) {
  if (!customPrompt || !customPrompt.trim()) {
    return defaultPrompt;
  }

  return `${defaultPrompt}

${SEPARATOR}
 ⚡ PRIORITY INSTRUCTIONS
 These instructions are provided by the operator for this specific
 session. They OVERRIDE the defaults above wherever they conflict.
${SEPARATOR}

${customPrompt.trim()}`;
}
