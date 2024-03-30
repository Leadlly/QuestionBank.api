import mongoose from "mongoose";

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        select: false,
        required: true
    },
    questions: [
       { 
        type: mongoose.Schema.Types.ObjectId,
        ref: "QuestionBank"
       }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
})

export const User = mongoose.model("User", userSchema)