import mongoose from "mongoose";

const subtopicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true, 
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

