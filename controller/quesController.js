import { Ques } from "../model/quesModel.js";
import { body, validationResult } from "express-validator";
import processImages from "../helper/processImages.js";
import { User } from "../model/userModel.js";
import deleteImages from "../helper/deleteImages.js";

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
  
    const hasCorrectOption = options.some(
      (option) => option.optionDb.tag === 'Correct'
    );
    if (!hasCorrectOption) {
      return res.status(400).json({
        success: false,
        message: 'At least one option must be correct',
      });
    }
    
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

    const user = await User.findById(question.createdBy);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if(question.images && question.images.length > 0) await deleteImages(question.images);

    console.log("dletee")
    question.options.forEach(async (option) => {
      if (option.images && option.images.length > 0) {
        await deleteImages(option.images);
      }
    });

    console.log("option delete")
    await question.deleteOne();

    user.questions.pull(question._id);
    await user.save();

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
    if (req.query.topics) queryObject.topics = req.query.topics;

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
export const getMyQuestions = async (req, res) => {
  try {
    const { standard, subject, chapter, topic } = req.query;
    const userId = req.user._id; 

    const query = {
      createdBy: userId,
      ...(standard && { standard }),
      ...(subject && { subject }),
      ...(chapter && { chapter: { $in: [chapter] } }),
      ...(topic && { topics: { $in: [topic] } })
    };

    const questions = await Ques.find(query);

    if (questions.length > 0) {
      res.status(200).json({ success: true, questions });
    } else {
      res.status(200).json({ success: false, message: "No questions found." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const editQuestion = async (req, res) => {
  try {
    const data = req.body;
    const ques = await Ques.findById(req.params.id);
    if (!ques) {
      return res.status(400).json({
        success: false,
        message: 'Question not exists',
      });
    }

    ques.question = data.question;

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


export const allUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Access Denied" });
    }

    const questions = await Ques.find({})
      .populate('createdBy', 'username'); // Populate the createdBy field with the username of the creator

    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};