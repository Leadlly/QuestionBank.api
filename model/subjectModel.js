import mongoose from "mongoose";

const subjectSchema = mongoose.Schema({
    subject: {
        name: String,
        chapters: [
            {
                name: String,
                topics: Array
            }
        ]
    }
})

export const Subject = mongoose.model("Subject", subjectSchema)