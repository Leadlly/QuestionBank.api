import mongoose from "mongoose";

const quesSchema = new mongoose.Schema({
    question: {
      type: String,
      required: true,
    },

  options: [
    {
      name: String,
      tag: {
        type: String,
        default: "Incorrect"
      },
      images: [
        {
          url: String,
          key: String
        }
      ]
    }
  ],

  standard: {
    type: Number,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  chaptersId: Array,
  topicsId: Array,
  subtopicsId: Array,
  chapter: {
    type: Array,
    required: true
  },
  topics: Array,
  subtopics: Array,
  
  nestedSubTopic: {
    type: String,
    required: false,
  },
  level: {
    type: String,
    required: false,
  },
  images: [{
    url: String,
    key: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Ques = mongoose.model("QuestionBank", quesSchema);
