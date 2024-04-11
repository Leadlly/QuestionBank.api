import mongoose from "mongoose";

const Schema = mongoose.Schema;

// Define the schema for subtopics.
const subtopicSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
// creating a recursive structure.
  subtopics: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Subtopic'
    }
  ],
});

// Optional: If you want to reference subtopics instead of embedding
// You need to create a model for it.
// const Subtopic = mongoose.model("Subtopic", subtopicSchema);

const topicSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  subtopics: [subtopicSchema], 
});

const chapterSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  topics: [topicSchema],
});

const subjectSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  standard: {
    type: String,
    required: true,
  },
  chapters: [chapterSchema],
});

// Create a model from the schema
export const Subject = mongoose.model("Subject", subjectSchema);


