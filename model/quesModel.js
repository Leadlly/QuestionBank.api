import mongoose, { Schema, mongo } from "mongoose";

const quesSchema = new Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    all: {
      type: Array,
      required: true
    },
    correct: {
      type: Array,
      required: true
    },
  },
  standard: {
    type: Number,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  chapter: {
    type: String,
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  subtopics: {
    type: Schema.Types.Mixed,
  },
  level: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Ques = mongoose.model("QuestionBank", quesSchema);
