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
      await Promise.all(validateAndSanitizeData.map((field) => field.run(req)));

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
      }

      const data = req.body;

     const existingQuestion = await Ques.findOne({
          question: data.question, 
          subject: data.subject, 
          standard: data.standard 
      });

      if (existingQuestion) {
          return res.status(409).json({
              success: false,
              message: 'Question already exists',
          });
      }

      const question = await Ques.create(data);

      req.user.questions.unshift(question._id);
      await req.user.save();

      res.status(201).json({ success: true, message: "Question added successfully", question });
  } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({
          success: false,
          message: error.message || 'Internal Server Error',
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

export const getAllQuestion = async (req, res) => {
  try {
    const queryObject = {};

    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;
    if (req.query.chapter) queryObject.chapter = req.query.chapter;
    if (req.query.topic) queryObject.topic = req.query.topic;

    const questions = await Ques.find(queryObject);
    if (!questions || questions.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    return res.status(200).json({ success: true, questions });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};


