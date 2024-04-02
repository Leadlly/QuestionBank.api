import mongoose from "mongoose";

const subjectSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  standard: {
    type: String,
    required: true,
  },
  chapters: [
    {
      name: String,
      topics: Array,
    },
  ],
});

export const Subject = mongoose.model("Subject", subjectSchema);
