import mongoose from "mongoose";

const chapterSchema = new mongoose.Schema({
    name: {
      type: String,
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
  chapterNumber:{
    type: Number,
    default: null
  },
    topics: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic"
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
          inherited: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    },
  });

chapterSchema.index({ name: 1, subjectName: 1 }, { unique: true });

export const Chapter = mongoose.model("Chapter", chapterSchema)  