import { Ques } from "../model/quesModel.js";
import { body, validationResult } from "express-validator";
import processImages from "../helper/processImages.js";

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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const data = req.body;

    // Check for existing question
    const existingQuestion = await Ques.findOne({
      question: data.question,
      subject: data.subject,
      standard: data.standard,
    });

    if (existingQuestion) {
      return res.status(400).json({
        success: false,
        message: 'Question already exists',
      });
    }

    // Process question images
    const imageUrls = await processImages(data.images);

   
    // Process option images
    const options = await Promise.all(data.options.map(async (option) => {
   
      let optionImageUrls = [];
      if (option.image && Array.isArray(option.image) && option.image.length > 0) {
        optionImageUrls = await processImages(option.image);
      }

      return {
      image: optionImageUrls,
       optionDb: { name: option.name,
        tag: option.isCorrect === true ? "Correct" : "Incorrect", 
        images: optionImageUrls.length > 0 ? optionImageUrls.map(image => ({ url: image?.getUrl, key: image?.key })) : null,}
      };
    }));
    const optionsSignedUrls = options.flatMap(option => (option.image ? option.image.map(image => image.putUrl) : []));
   const newQuestion = new Ques({
      question: data.question,
      options: options.map((option) => option.optionDb),
      standard: data.standard,
      subject: data.subject,
      chapter: data.chapter,
      topics: data.topics,
      subtopics: data.subtopics,
      nestedSubTopic: data.nestedSubTopic,
      level: data.level,
      images: imageUrls.map(image => ({ url: image.getUrl, key: image.key })),
      createdBy: req.user._id
    });

    await newQuestion.save();
    req.user.questions.push(newQuestion._id);
    await req.user.save();

    res.status(201).json({
      success: true,
      message: 'Question added successfully',
      question: newQuestion,
      signedUrls: imageUrls.map((image) => image.putUrl),
      optionsSignedUrls: optionsSignedUrls,
    });
  } catch (error) {
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

    // Remove the question from the questions array of all users
    await User.updateMany(
      { questions: question._id },
      { $pull: { questions: question._id } }
    );

    res.status(200).json({ success: true, message: "Question Deleted" });
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

    const formattedQuestions = questions.map(question => ({
      ...question.toObject(),
      nestedSubTopic: question.nestedSubTopic || "" 
    }));

    return res.status(200).json({ success: true, questions: formattedQuestions });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const editQuestion = async (req, res) => {
  try {
    const data = req.body;
    // Check for existing question
    const ques = await Ques.findById(req.params.id);
    if (!ques) {
      return res.status(400).json({
        success: false,
        message: 'Question not exists',
      });
    }

    // Update question
    ques.question = data.question;

    // Save the updated question
    await ques.save();

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      question: ques,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

export const updateOption = async (req, res) => {
  try {
    const data = req.body;
    // Check for existing question
    const ques = await Ques.findById(req.params.id);
    if (!ques) {
      return res.status(400).json({
        success: false,
        message: 'Question not exists',
      });
    }
    // Find the option to update
    const optionToUpdate = ques.options.find((option) => option._id.toString() === req.params.optionId);
    if (!optionToUpdate) {
      return res.status(400).json({
        success: false,
        message: 'Option not found',
      });
    }
    // Update the option
    optionToUpdate.name = data.name;
    optionToUpdate.tag = data.tag;
    // Save the updated question
    await ques.save();
    return res.status(200).json({
      success: true,
      message: 'Option updated successfully',
      question: ques,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};
