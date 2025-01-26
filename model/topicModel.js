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
  topicNumber: {  
    type: Number,
    default: undefined,
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
  exam: [{ type: String }]
}, { timestamps: true });

 
export const Topic = mongoose.model("Topic", topicSchema)  

