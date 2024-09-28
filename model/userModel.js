import mongoose from "mongoose";

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    select: false,
    required: true,
  },
  status: {
    type: String,
    enum: ["Verified", "Not Verified"],
    default: "Not Verified",
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionBank",
    },
  ],
  requests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


userSchema.methods.getQuestionsByStandard = async function (standard) {
  console.log('Standard:', standard); // Log the standard value
  const filteredQuestions = await mongoose.model('QuestionBank').find({
    _id: { $in: this.questions },
    standard: standard,
  });
  console.log('Filtered Questions:', filteredQuestions); // Log the filtered questions
  return filteredQuestions;
};



export const User = mongoose.model("User", userSchema);
