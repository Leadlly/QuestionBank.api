import mongoose from "mongoose";

const subtopicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true, 
    },
    topicName: {
        type: String,
        required: true,
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
    subtopics: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subtopic',
            default: [], 
        }
    ],
});

export const Subtopic = mongoose.model("Subtopic", subtopicSchema);

