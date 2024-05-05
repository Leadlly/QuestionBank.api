import mongoose, { Schema, mongo } from "mongoose";

const quesSchema = new mongoose.Schema({
  question: {
      type: String,
      required: true,
  },
  options: {
      all: {
          type: [String],
          required: true
      },
      correct: {
          type: [String],
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
      type: [{
          name: {
              type: String,
              required: true,
          },
          subtopics: {
              type: [
                  {
                      name: {
                          type: String,
                          required: true,
                      },
                      subtopics: {
                          type: Array,
                          default: []
                      }
                  }
              ],
              default: []
          }
      }],
      default: [],
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
