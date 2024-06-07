import { Ques } from "../model/quesModel.js";
import { body, validationResult } from "express-validator";
import {getObjectSignedUrl, getPutObjectSignedUrl} from "../utils/getSignedUrl.js";

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

    let imageUrls;

   
    if (!data.images || !Array.isArray(data.images)) {
     
      imageUrls = [];
    } else {
      imageUrls = await Promise.all(data.images.map(async (image) => {
        const bucketKey = `questions/${new Date().getTime()}-${image.name}`;
        const putObjectInfo = {
          Bucket: 'leadlly-questions',
          Key: bucketKey,
          ContentType: image.type,
        };
        const putSignedUrl = await getPutObjectSignedUrl(putObjectInfo);

        const getObjectInfo = {
          Bucket: 'leadlly-questions',
          Key: bucketKey,
        };
        const getSignedUrl = await getObjectSignedUrl(getObjectInfo);
        
        return { putUrl: putSignedUrl, getUrl: getSignedUrl, key: bucketKey };
      }));
    }

    const options = data.options.map((option, index) => ({
      type: option.type,
      tag: option.tag || 'Incorrect',
      images: option.images || [],
    }));
    

    const newQuestion = new Ques({
      question: {
        question: data.question, 
        images: data.images.map(image => ({
          url: image.url,
          key: image.key
        }))
      },
      options: options,
      standard: data.standard,
      subject: data.subject,
      chapter: data.chapter,
      topic: data.topic,
      subtopics: data.subtopics,
      nestedSubTopic: data.nestedSubTopic,
      level: data.level,
      images: imageUrls.map(image => ({ url: image.getUrl, key: image.key })),
    });

    await newQuestion.save();
    req.user.questions.push(newQuestion._id);
    await req.user.save();

    res.status(201).json({
      success: true,
      message: 'Question added successfully',
      question: newQuestion,
      signedUrls: imageUrls.map((image) => image.putUrl),
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




