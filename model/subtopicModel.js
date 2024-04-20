import mongoose from "mongoose";

const subtopicSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
  // creating a recursive structure.
    subtopics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subtopic'
      }
    ],
  });
  
export const Subtopic = mongoose.model("Subtopic", subtopicSchema)