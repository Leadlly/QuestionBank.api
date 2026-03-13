/**
 * ai/prompts/levelPrompts.js
 *
 * Per-exam-level prompt supplements for the Question Generator Agent.
 *
 * Each entry contains:
 *   - examProfile
 *   - questionStyle
 *   - pyqExamples
 *
 * These examples are derived from real previous-year exam patterns.
 * They exist ONLY to anchor difficulty and style.
 * The model must NOT copy them.
 */

// ─────────────────────────────────────────────────────────────

const BOARDS = `
═══════════════════════════════════════════════════════
 EXAM LEVEL: BOARDS (CBSE)
═══════════════════════════════════════════════════════

TARGET AUDIENCE
  Class 10–12 students preparing for CBSE Board exams.

EXAM CHARACTER
  - Questions are directly aligned with NCERT textbooks.
  - Primarily test recall, comprehension, and single-concept application.
  - Language mirrors NCERT — clear and straightforward.
  - Numerical questions involve direct substitution.

QUESTION STYLE
  - Definition-based questions
  - Formula identification
  - Direct numerical substitution
  - Concept-based MCQs from NCERT lines

DIFFICULTY RULE FOR THIS SESSION

• Each question must test only ONE clear concept from NCERT.
• Numerical questions must involve direct substitution into a known formula.
• Language should closely resemble textbook phrasing and avoid ambiguity.
• Distractors should represent common student mistakes such as wrong formula, wrong unit, or incorrect definition.

PYQ-STYLE EXAMPLES

Example — Physics

{
  "question": "According to Gauss's law, the electric flux through a closed surface depends on:",
  "options": [
    { "name": "Shape of the surface", "isCorrect": false },
    { "name": "Charge enclosed by the surface", "isCorrect": true },
    { "name": "Area of the surface", "isCorrect": false },
    { "name": "Electric field outside the surface", "isCorrect": false }
  ],
  "level": "Boards"
}

Example — Mathematics

{
  "question": "The sum of the first n terms of an arithmetic progression with first term a and common difference d is:",
  "options": [
    { "name": "n/2 (a + (n-1)d)", "isCorrect": false },
    { "name": "n (2a + (n-1)d)", "isCorrect": false },
    { "name": "n/2 (2a + (n-1)d)", "isCorrect": true },
    { "name": "n/2 (a + nd)", "isCorrect": false }
  ],
  "level": "Boards"
}
`.trim();

// ─────────────────────────────────────────────────────────────

const NEET = `
═══════════════════════════════════════════════════════
 EXAM LEVEL: NEET
═══════════════════════════════════════════════════════

TARGET AUDIENCE
  Students preparing for NEET-UG medical entrance exam.

EXAM CHARACTER
  - Biology heavily based on NCERT text and diagrams.
  - Physics and Chemistry involve conceptual application with moderate calculation.
  - Distractors are very close conceptual alternatives.

QUESTION STYLE
  - NCERT line-based questions
  - Biological processes and sequences
  - Simple conceptual numericals
  - Terminology-based identification

DIFFICULTY RULE FOR THIS SESSION

• Most questions should be derived from NCERT statements, processes, or diagrams.
• Physics and Chemistry numericals should require 1–2 conceptual steps.
• Biology questions should test precise terminology or correct sequence of biological processes.
• Distractors must be conceptually close alternatives to test fine conceptual understanding.

PYQ-STYLE EXAMPLES

Example — Biology

{
  "question": "Thermostable DNA polymerase used in PCR was isolated from:",
  "options": [
    { "name": "Escherichia coli", "isCorrect": false },
    { "name": "Thermus aquaticus", "isCorrect": true },
    { "name": "Agrobacterium tumefaciens", "isCorrect": false },
    { "name": "Bacillus subtilis", "isCorrect": false }
  ],
  "level": "Neet"
}

Example — Physics

{
  "question": "A body of mass 2 kg moves with velocity 5 m/s. Its kinetic energy is:",
  "options": [
    { "name": "10 J", "isCorrect": false },
    { "name": "25 J", "isCorrect": true },
    { "name": "50 J", "isCorrect": false },
    { "name": "5 J", "isCorrect": false }
  ],
  "level": "Neet"
}
`.trim();

// ─────────────────────────────────────────────────────────────

const JEE_MAINS = `
═══════════════════════════════════════════════════════
 EXAM LEVEL: JEE MAINS
═══════════════════════════════════════════════════════

TARGET AUDIENCE
  Students targeting NIT / IIIT admission.

EXAM CHARACTER
  - Moderate conceptual difficulty.
  - Often combines two related concepts.
  - Numerical questions require short calculations.

QUESTION STYLE
  - Multi-step formula application
  - Conceptual trap questions
  - Graph interpretation
  - Dimensional analysis

DIFFICULTY RULE FOR THIS SESSION

• Each question should combine at least two related concepts from the syllabus.
• Numerical problems should involve 2–3 logical steps or intermediate calculations.
• Distractors must correspond to common mistakes such as sign errors or incorrect formula usage.
• Problems should require conceptual reasoning rather than simple formula recall.

PYQ-STYLE EXAMPLES

Example — Physics

{
  "question": "A solid sphere rolls without slipping with velocity v. The ratio of translational kinetic energy to rotational kinetic energy is:",
  "options": [
    { "name": "5:2", "isCorrect": true },
    { "name": "2:5", "isCorrect": false },
    { "name": "1:1", "isCorrect": false },
    { "name": "3:2", "isCorrect": false }
  ],
  "level": "JeeMains"
}

Example — Mathematics

{
  "question": "If |A| = 5 for a 3×3 matrix A, then |adj(A)| equals:",
  "options": [
    { "name": "5", "isCorrect": false },
    { "name": "25", "isCorrect": true },
    { "name": "125", "isCorrect": false },
    { "name": "15", "isCorrect": false }
  ],
  "level": "JeeMains"
}
`.trim();

// ─────────────────────────────────────────────────────────────

const JEE_ADVANCE = `
═══════════════════════════════════════════════════════
 EXAM LEVEL: JEE ADVANCED
═══════════════════════════════════════════════════════

TARGET AUDIENCE
  Top JEE aspirants targeting IIT admission.

EXAM CHARACTER
  - Highest conceptual difficulty among engineering entrance exams.
  - Problems frequently integrate multiple topics or chapters.
  - Requires multi-step reasoning and derivations.
  - Questions may involve unfamiliar scenarios requiring first-principle thinking.

QUESTION STYLE
  - Cross-chapter conceptual problems
  - Advanced calculus or algebraic manipulation
  - Physics derivations involving multiple laws
  - Complex chemical equilibrium or thermodynamics reasoning

DIFFICULTY RULE FOR THIS SESSION

• Each question must integrate multiple concepts or chapters from the syllabus.
• Problems should require multi-step reasoning, intermediate derivations, or algebraic manipulation.
• Questions should test deep conceptual understanding rather than direct formula substitution.
• Distractors must correspond to realistic partial-concept mistakes that trap students with incomplete understanding.

PYQ-STYLE EXAMPLES

Example — Mathematics

{
  "question": "The positive integer n > 3 satisfying the equation 1/sin(π/n) = 1/sin(2π/n) + 1/sin(3π/n) is:",
  "options": [
    { "name": "5", "isCorrect": false },
    { "name": "6", "isCorrect": true },
    { "name": "7", "isCorrect": false },
    { "name": "8", "isCorrect": false }
  ],
  "level": "JeeAdvance"
}

Example — Mathematics

{
  "question": "The value of the integral ∫₀^π [x sin(x)/(1 + cos²x)] dx is:",
  "options": [
    { "name": "π²/2", "isCorrect": false },
    { "name": "π²/4", "isCorrect": true },
    { "name": "π²/8", "isCorrect": false },
    { "name": "π/2", "isCorrect": false }
  ],
  "level": "JeeAdvance"
}
`.trim();

// ─────────────────────────────────────────────────────────────

export const LEVEL_PROMPTS = {
  boards: BOARDS,
  neet: NEET,
  jeemains: JEE_MAINS,
  jeeadvance: JEE_ADVANCE,
};

export function getLevelPrompt(level) {
  if (!level) return null;
  return LEVEL_PROMPTS[level.toLowerCase()] ?? null;
}