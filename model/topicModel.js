import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({
  name: {
      type: String,
      required: true,
  },
  chapterName: {
    type: String,
    required: true,
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chapter",
    required: true,
},
  subjectName: {
    type: String,
    required: true,
},
standard: {
    type: Number,
    required: true,
},
topicNumber: {
  type: Number,
  default: null
},
  subtopics: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subtopic",
      default: [],
  }],
  exam: [{ type: String }],
  examWeights: {
    type: [
      {
        exam: { type: String },
        examImportance: { type: Number, default: null },
        frequencyRate: { type: Number, default: null },
        recencyScore: { type: Number, default: null },
        importanceConfidence: { type: Number, default: null },
        rawValue: { type: Number, default: null },
        provisional: { type: Boolean, default: true },
        inherited: { type: Boolean, default: true },
      },
    ],
    default: undefined,
  },
}, { timestamps: true });

topicSchema.index({ name: 1, chapterId: 1 }, { unique: true });

export const Topic = mongoose.model("Topic", topicSchema)  

