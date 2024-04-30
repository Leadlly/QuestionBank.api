import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    standard: {
        type: String,
        required: true,
    },
    chapters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
    }],
});

export const Subject = mongoose.model("Subject", subjectSchema);

