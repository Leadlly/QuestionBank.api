import { Ques } from "../model/quesModel.js";
import { Chapter } from "../model/chapterModel.js";
import { Topic } from "../model/topicModel.js";
import { Subtopic } from "../model/subtopicModel.js";
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

    const imageUrls = await processImages(data.images);

   
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

    question.options.forEach(async (option) => {
      if (option.images && option.images.length > 0) {
        await deleteImages(option.images);
      }
    });

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

    // Handle standard and subject queries
    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;
    if (req.query.createdBy) queryObject.createdBy = req.query.createdBy;

    // Handle multiple chapters
    if (req.query.chapter) {
      const chapters = Array.isArray(req.query.chapter)
        ? req.query.chapter
        : req.query.chapter.split(',').map(ch => ch.trim());
      queryObject.chapter = { $in: chapters };
    }

    // Handle single or multiple topics
    if (req.query.topic) {
      const topics = Array.isArray(req.query.topic)
        ? req.query.topic
        : req.query.topic.split(',').map(tp => tp.trim());

      if (topics.length === 1) {
        // If single topic, use direct equality
        queryObject.topics = topics[0];
      } else {
        // If multiple topics, use $in
        queryObject.topics = { $in: topics };
      }
    }

    // Handle search query
    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));
      queryObject.$and = [
        { $or: searchRegex.map(regex => ({ question: regex })) }
      ];
    }

    console.log(queryObject); // For debugging purposes

    let formattedQuestions = [];

    if (req.user.role === "admin") {
      let questionsData = Ques.find(queryObject).sort({ createdAt: -1 });

      let page = req.query.page || 1;
      let limit = req.query.limit || 50;

      let skip = (page - 1) * limit;

      questionsData = questionsData.skip(skip).limit(limit);

      const questions = await questionsData;

      if (!questions || questions.length === 0) {
        return res.status(404).json({ success: false, message: "Question not found" });
      }

      formattedQuestions = questions.map(question => ({
        ...question.toObject(),
        nestedSubTopic: question.nestedSubTopic || ""
      }));
    }

    let todaysQuestionsCount = 0;
    let userRank = null;
    let topperUser = null;
    let topperUserQuestionsCount = 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (req.query.createdBy) {
      const todaysQuestions = await Ques.find({
        createdBy: req.query.createdBy,
        createdAt: { $gte: startOfToday, $lt: endOfToday },
      });

      todaysQuestionsCount = todaysQuestions.length;

      const users = await User.find();
      const userCounts = await Promise.all(users.map(async user => {
        const userQuestions = await Ques.find({
          createdBy: user._id,
          createdAt: { $gte: startOfToday, $lt: endOfToday },
        });
        return { userId: user._id, count: userQuestions.length };
      }));

      userCounts.sort((a, b) => b.count - a.count);

      userRank = userCounts.findIndex(user => user.userId.toString() === req.query.createdBy) + 1;

      if (userCounts.length > 0) {
        const topperUserId = userCounts[0].userId;
        topperUser = await User.findById(topperUserId).select('name');
        topperUserQuestionsCount = userCounts[0].count;
      }
    } else {
      const users = await User.find();
      const userCounts = await Promise.all(users.map(async user => {
        const userQuestions = await Ques.find({
          createdBy: user._id,
          createdAt: { $gte: startOfToday, $lt: endOfToday },
        });
        return { userId: user._id, count: userQuestions.length };
      }));

      userCounts.sort((a, b) => b.count - a.count);

      if (userCounts.length > 0) {
        const topperUserId = userCounts[0].userId;
        topperUser = await User.findById(topperUserId).select('name');
        topperUserQuestionsCount = userCounts[0].count;
      }
    }

    return res.status(200).json({
      success: true,
      questions: formattedQuestions,
      todaysQuestionsCount: todaysQuestionsCount,
      userRank: userRank,
      topperUser: {
        name: topperUser,
        QuestionsCount: topperUserQuestionsCount
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};




export const getTotalQuestions = async (req, res) => {
  try {
    const queryObject = {};
    const userId = req.user._id;

    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;

    // Handle multiple chapters
    if (req.query.chapter) {
      const chapters = Array.isArray(req.query.chapter)
        ? req.query.chapter  // If it's already an array, use it directly
        : req.query.chapter.split(',').map(chapter => chapter.trim());
      queryObject.chapter = { $in: chapters }; // Matches any of the chapters
    }

    // Handle multiple topics
    if (req.query.topic) {
      const topics = Array.isArray(req.query.topic)
        ? req.query.topic  // If it's already an array, use it directly
        : req.query.topic.split(',').map(topic => topic.trim());
      queryObject.topics = { $in: topics }; // Matches any of the topics
    }

    if (req.query.createdBy) queryObject.createdBy = req.query.createdBy;

    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));

      queryObject.$and = [{ $or: searchRegex.map(regex => ({ question: regex })) }];
    }

    if (req.query.mySearch) {
      const searchTerms = req.query.mySearch.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));

      queryObject.$and = [
        { $or: searchRegex.map(regex => ({ question: regex })) },
        { createdBy: userId },
      ];
    }

    console.log(queryObject);

    // Get the total count of questions matching the query
    const totalQuestions = await Ques.countDocuments(queryObject);

    let myQuestions, questionsLength, fixedTotalQuestions, totalMyQuestions, totalMyPages, totalPages;

    // Get the count of questions created by the user
    const queryObjects = { ...queryObject, createdBy: userId };
    myQuestions = await Ques.find(queryObjects);
    questionsLength = myQuestions.length;

    totalMyQuestions = await Ques.countDocuments({ createdBy: userId });

    // Calculate total pages for the user's questions and total questions
    totalMyPages = Math.ceil(totalMyQuestions / req.query.questionsPerPage);
    fixedTotalQuestions = await Ques.countDocuments({}); // Total questions in the collection
    totalPages = Math.ceil(totalQuestions / req.query.questionsPerPage);

    return res.status(200).json({
      success: true,
      totalQuestions: totalQuestions,
      questionsLength: questionsLength,
      fixedTotalQuestions: fixedTotalQuestions,
      totalMyQuestions: totalMyQuestions,
      totalPages: totalPages,
      totalMyPages: totalMyPages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};



export const getMyQuestions = async (req, res) => {
  try {
    const userId = req.user._id; 

    const queryObject = { createdBy: userId };
    
    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;
    if (req.query.chapter) queryObject.chapter = req.query.chapter;
    if (req.query.topic) queryObject.topics = req.query.topic;
     if (req.query.search) {
      // Split search query by spaces to handle multiple words
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');

      // Create regex pattern to match each term individually
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));

      // Use $and with $or to match any of the terms
      queryObject.$and = [
        { $or: searchRegex.map(regex => ({ question: regex })) }
      ];
    }
    console.log(queryObject)
    const totalQuestions = await Ques.countDocuments(queryObject);

    let questionsData = Ques.find(queryObject);

    let page = req.query.page || 1;
    let limit = req.query.limit || 50;
  
    let skip = (page - 1) * limit;

    questionsData = questionsData.skip(skip).limit(limit);

    const paginatedQuestions = await questionsData;


    if (!paginatedQuestions.length) {
      return res.status(400).json({ success: false, message: "No questions found." });
    }

    // Get the start and end of today's date
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Query to get today's questions for the current user
    const todaysQuestions = await Ques.find({
      createdBy: userId,
      createdAt: { $gte: startOfToday, $lt: endOfToday },
    });

    // Get all users' today's questions count
    const users = await User.find();
    const userCounts = await Promise.all(users.map(async user => {
      const userQuestions = await Ques.find({
        createdBy: user._id,
        createdAt: { $gte: startOfToday, $lt: endOfToday },
      });
      return { userId: user._id, count: userQuestions.length };
    }));

    // Sort users by their today's questions count in descending order
    userCounts.sort((a, b) => b.count - a.count);

    // Determine the rank of the current user
    const userRank = userCounts.findIndex(user => user.userId.toString() === userId.toString()) + 1;

    res.status(200).json({ 
      success: true, 
      questions: paginatedQuestions,
      todaysQuestionsCount: todaysQuestions.length,
      userRank: userRank,
      totalQuestions: totalQuestions
    });
    
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
     const users = await User.find({})
     if(!users) return res.status(404).json({ error: "Users not found" });

     res.status(200).json({
      success: true,
      users
     });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: error.message });
  }
};


export const updateQuestionDetails = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { standard, subject, chapter, topics, subtopics } = req.body;

    const question = await Ques.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    if (subject && subject !== question.subject) {
      question.subject = subject;

      if (chapter) {
        question.chapter = chapter;
      } else {
        question.chapter = [];
      }

      if (topics) {
        question.topics = topics;
      } else {
        question.topics = [];
      }

      if (subtopics) {
        question.subtopics = subtopics;
      } else {
        question.subtopics = [];
      }
    } else {
      if (standard) question.standard = standard;
      if (chapter) question.chapter = chapter;
      if (topics) question.topics = topics;
      if (subtopics) question.subtopics = subtopics;
    }

    await question.save();

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      question,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};

