import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({
  name: {
      type: String,
      required: true,
      unique: true
  },
  chapterName: {
    type: String,
    required: true,
  },
  subjectName: {
    type: String,
    required: true,
},
standard: {
    type: String,
    required: true,
},
  subtopics: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subtopic",
      default: [],
  }],
  exam: [{ type: String }]
}, { timestamps: true });

 
export const Topic = mongoose.model("Topic", topicSchema)  

