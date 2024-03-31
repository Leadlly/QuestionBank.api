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
    status: {
        type: String,
        enum: ["Verified", "Not Verified"],
        default: "Not Verified"
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    questions: [
       { 
        type: mongoose.Schema.Types.ObjectId,
        ref: "QuestionBank"
       }
    ],
    requests: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
})

export const User = mongoose.model("User", userSchema)