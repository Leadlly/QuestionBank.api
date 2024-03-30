import mongoose, { Schema, mongo } from "mongoose";

const quesSchema = new Schema({
  ques: {
    type: String,
    required: true,
  },
  options: {
    all: Array,
    correct: Array,
  },
  class: {
    type: String,
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
  level: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Ques = mongoose.model("QuestionBank", quesSchema)