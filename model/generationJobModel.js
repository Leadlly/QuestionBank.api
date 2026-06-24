import mongoose from "mongoose";

/**
 * Tracks an async AI question generation + auto-insert job.
 *
 * Lifecycle:
 *   pending  → generating (AI is running)
 *   generating → done | failed
 *
 * `questions` is populated incrementally as each question is saved to the
 * QuestionBank collection, so the frontend can poll and show results live.
 */
const generationJobSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["pending", "generating", "done", "failed"],
    default: "pending",
  },

  // Curriculum scope — stored so the polling client can display context
  standard: Number,
  subject: String,
  chapter: String,
  topic: String,
  subtopic: String,
  level: String,
  includeSolutions: { type: Boolean, default: false },

  // IDs of questions successfully inserted into QuestionBank during this job
  insertedQuestionIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "QuestionBank",
    default: [],
  },

  // Running count — incremented as each question is saved
  insertedCount: { type: Number, default: 0 },

  // Total the AI was asked to generate (used to show progress)
  requestedCount: { type: Number, default: 0 },

  // Error message if status === "failed"
  error: { type: String, default: null },

  // When true: topics were selected but NO explicit subtopics were chosen.
  // The background worker will fetch subtopics for the given topics and use
  // AI to assign each generated question to its best-matching subtopic.
  autoAssignSubtopics: { type: Boolean, default: false },

  // Supplementary data passed to the background worker for DB inserts
  chaptersId:    { type: [mongoose.Schema.Types.ObjectId], default: [] },
  topicsId:      { type: [mongoose.Schema.Types.ObjectId], default: [] },
  subtopicsId:   { type: [mongoose.Schema.Types.ObjectId], default: [] },
  chapterNames:  { type: [String], default: [] },
  topicNames:    { type: [String], default: [] },
  subtopicNames: { type: [String], default: [] },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

export const GenerationJob = mongoose.model("GenerationJob", generationJobSchema);
