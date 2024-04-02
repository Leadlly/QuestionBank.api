import { Ques } from "../model/quesModel.js";
import { body, validationResult } from "express-validator";

const validateAndSanitizeData = [
  body("question").notEmpty().trim().escape(),
  body("options.all.*").notEmpty().trim().escape(),
  body("options.correct.*").notEmpty().trim().escape(),
  body("standard").notEmpty().trim().escape(),
  body("subject").notEmpty().trim().escape(),
  body("chapter").notEmpty().trim().escape(),
  body("topic").notEmpty().trim().escape(),
  body("level").notEmpty().trim().escape(),
];

export const createQuestion = async (req, res) => {
  try {
    // Validate and sanitize the request body
    await Promise.all(validateAndSanitizeData.map((field) => field.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const data = req.body;
    const question = await Ques.create(data);

    req.user.questions.unshift(question._id);
    await req.user.save();

    res
      .status(201)
      .json({ success: true, message: "Question Added", question });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const question = await Ques.findById(req.params.id);
    if (!question)
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });

    await question.deleteOne();

    req.user.questions = req.user.questions.filter(
      (ques) => ques._id.toString() !== question._id.toString(),
    );
    await req.user.save();

    res.status(201).json({ success: true, message: "Question Deleted" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
