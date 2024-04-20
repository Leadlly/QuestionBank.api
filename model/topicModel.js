import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    subtopics: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subtopic"
    }, 
  });
 
export const Topics = mongoose.model("Topic", topicSchema)  