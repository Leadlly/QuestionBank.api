import mongoose from "mongoose";

const quesSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
    },
    options: {
        all: {
            type: [String],
            required: true,
        },
        correct: {
            type: [String],
            required: true,
        },
    },
    standard: {
        type: Number,
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    chapter: {
        type: String,
        required: true,
    },
    topic: {
        type: String,
    },
    subtopics: {
        type: String, 
        required: false,
    },
    nestedSubTopic: {
        type: String, 
        required: false,
    },
    level: {
        type: String,
        required: true,
    },
    images: [{
        url: String,
        key: String
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Ques = mongoose.model("QuestionBank", quesSchema);
