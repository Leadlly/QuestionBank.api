import { Ques } from "../model/quesModel.js";
import { body, validationResult } from 'express-validator';

const validateAndSanitizeData = [
  body('ques').notEmpty().trim().escape(),
  body('options.all.*').notEmpty().trim().escape(),
  body('options.correct.*').notEmpty().trim().escape(),
  body('class').notEmpty().trim().escape(),
  body('subject').notEmpty().trim().escape(),
  body('chapter').notEmpty().trim().escape(),
  body('topic').notEmpty().trim().escape(),
  body('level').notEmpty().trim().escape(),
];

export const createQuestion = async (req, res) => {
  try {
    // Validate and sanitize the request body
    await Promise.all(validateAndSanitizeData.map(field => field.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const data = req.body;
    const question = await Ques.create(data);

    return res.status(201).json({ success: true, question });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};
