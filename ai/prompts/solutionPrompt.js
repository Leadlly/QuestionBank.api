/**
 * ai/prompts/solutionPrompt.js
 *
 * Single source of truth for solution generation rules.
 * Used by:
 *   - agentController.js  (injected when includeSolutions=true during question generation)
 *   - solutionAgent.js    (standalone "Generate Solution with AI" button)
 */

export const solutionPrompt = `SOLUTION REQUIREMENT (apply to every question):

Each question object MUST include a "solution" key whose value is a single Markdown string
containing a complete, human-quality worked solution — exactly as a top student or teacher
would write it on paper. Store the entire solution in ONE string field called "content".

"solution": {
  "content": "<full markdown solution here>"
}

═══════════════════════════════════════════════════════
 STEP 1 — READ THE QUESTION CONTEXT CAREFULLY
═══════════════════════════════════════════════════════

Before writing a single word of the solution, carefully read and absorb:

- Subject      : understand which domain this question belongs to (Physics / Chemistry /
                 Biology / Mathematics / etc.) and apply the correct framework.
- Chapter      : identify the specific chapter — this tells you the exact topic cluster
                 the question is drawn from. Do NOT bring in concepts from other chapters.
- Topics       : use only the concepts listed under these topics. The solution must be
                 rooted in exactly what is taught in this topic.
- Subtopics    : narrow your explanation to this subtopic where relevant.
- Level        : calibrate the depth, language, and shortcut usage to the exam level:
    • boards       → NCERT-aligned, clear step-by-step, accessible to all students
    • neet         → NCERT-based reasoning, biology/chemistry/physics focused, precise
    • jeemains_easy → standard approach, moderate rigor, one clean method
    • jeemains     → concise but rigorous, shortcut tips welcome, exam-style language
    • jeeadvance   → deep conceptual reasoning, multiple approaches if applicable,
                     elegant proofs or derivations encouraged
- Standard (Class) : pitch the language and complexity to match that class level.
  A Class 8 student and a Class 12 JEE Advanced student need very different explanations.

═══════════════════════════════════════════════════════
 STEP 2 — VERIFY YOUR SOLUTION LEADS TO THE CORRECT OPTION
═══════════════════════════════════════════════════════

The correct option is clearly marked in the question data. Your solution MUST:

- Lead logically and unambiguously to that correct option.
- Explain clearly WHY the correct option is right.
- For MCQs: address all 4 options — explain why the 3 wrong options are incorrect
  (process of elimination) so the student gains full understanding.
- Never contradict the marked correct answer. If your working leads to a different
  answer, recheck your reasoning before writing the solution.

═══════════════════════════════════════════════════════
 STEP 3 — WRITE FOR EVERY STUDENT TO UNDERSTAND
═══════════════════════════════════════════════════════

RULES for writing the solution content:

1. Write the solution as continuous prose + math, NOT as a JSON sub-object or bullet dump.
2. Start with a one-line conceptual statement: what principle / formula / law applies.
3. Use simple, direct language. Assume the student is reading this for the first time.
   Avoid jargon unless it is standard for the subject and level.
4. For NUMERICAL questions:
   - State the formula first, then substitute values step by step.
   - Write equations inline using plain text math (e.g. F = ma = 5 × 2 = 10 N).
   - Show every intermediate step — never skip algebra.
   - Call out units at every step and end with a clearly labelled final answer
     with correct SI/CGS units.
5. For THEORY / CONCEPTUAL questions:
   - Explain the underlying concept in 2–4 sentences in plain language.
   - Reason through why each wrong option is incorrect.
   - Conclude with a clear statement of the correct answer and why it is right.
6. Use Markdown formatting freely: **bold** for key terms, ## headings to separate
   sections (e.g. ## Concept, ## Solution, ## Why other options are wrong),
   horizontal rules (---) between sections, inline code for equations if helpful.
7. Minimum length: 100 words. The solution must be fully self-contained and
   understandable without referring back to the question.
8. End with a one-line summary: "**Answer: [correct option text]**" so the student
   can instantly confirm they understood correctly.`;
