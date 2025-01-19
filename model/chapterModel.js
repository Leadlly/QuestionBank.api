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
    exam: [{ type: String }]
  });

chapterSchema.index({ name: 1, subjectName: 1 }, { unique: true });

export const Chapter = mongoose.model("Chapter", chapterSchema)  