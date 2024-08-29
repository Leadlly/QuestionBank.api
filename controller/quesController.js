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

    // Handle standard, subject, and createdBy queries
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
      queryObject.topics = { $in: topics };
    }

    // Handle subtopics
    if (req.query.subtopic) {
      const subtopics = Array.isArray(req.query.subtopic)
        ? req.query.subtopic
        : req.query.subtopic.split(',').map(st => st.trim());
queryObject.subtopics = {$in: subtopics}
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
    console.error("Error in getAllQuestion:", error);
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

    // Handle standard and subject queries
    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;

    // Handle multiple chapters
    if (req.query.chapter) {
      const chapters = Array.isArray(req.query.chapter)
        ? req.query.chapter
        : req.query.chapter.split(',').map(chapter => chapter.trim());
      queryObject.chapter = { $in: chapters };
    }

    // Handle single or multiple topics
    if (req.query.topic) {
      const topics = Array.isArray(req.query.topic)
        ? req.query.topic
        : req.query.topic.split(',').map(topic => topic.trim());
      queryObject.topics = { $in: topics };
    }

    // Handle subtopics
    if (req.query.subtopic) {
      const subtopics = Array.isArray(req.query.subtopic)
        ? req.query.subtopic
        : req.query.subtopic.split(',').map(subtopic => subtopic.trim());

      queryObject.subtopics = { $in: subtopics };
    }

    // Handle createdBy query
    if (req.query.createdBy) queryObject.createdBy = req.query.createdBy;

    // Handle search query
    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));
      queryObject.$and = [{ $or: searchRegex.map(regex => ({ question: regex })) }];
    }

    // Handle mySearch query to search within user's created questions
    if (req.query.mySearch) {
      const searchTerms = req.query.mySearch.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));
      queryObject.$and = [
        { $or: searchRegex.map(regex => ({ question: regex })) },
        { createdBy: userId },
      ];
    }

    console.log(queryObject); // For debugging purposes

    // Get the total count of questions matching the query
    const totalQuestions = await Ques.countDocuments(queryObject);

    // Get the count of questions created by the user
    const myQuestionsQueryObject = { ...queryObject, createdBy: userId };
    const totalMyQuestions = await Ques.countDocuments(myQuestionsQueryObject);

    // Calculate total pages
    const questionsPerPage = parseInt(req.query.questionsPerPage) || 10; // Set a default value if not provided
    const totalPages = Math.ceil(totalQuestions / questionsPerPage);
    const totalMyPages = Math.ceil(totalMyQuestions / questionsPerPage);

    // Get the total count of all questions in the collection
    const fixedTotalQuestions = await Ques.countDocuments({});

    return res.status(200).json({
      success: true,
      totalQuestions: totalQuestions,
      totalMyQuestions: totalMyQuestions,
      fixedTotalQuestions: fixedTotalQuestions,
      totalPages: totalPages,
      totalMyPages: totalMyPages,
    });
  } catch (error) {
    console.error("Error in getTotalQuestions:", error); // Added logging for debugging
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

export const updateQuestionTopics = async (req, res) => {
  try {
    const { questionIds, subtopic, topic } = req.body;

    // Ensure questionIds is an array
    const ids = Array.isArray(questionIds) ? questionIds : [questionIds];

    if (ids.length === 0) {
      return res.status(400).json({ message: 'No question IDs provided.' });
    }

    // Find questions with the provided IDs
    const existingQuestions = await Ques.find({ _id: { $in: ids } });
    if (existingQuestions.length === 0) {
      return res.status(404).json({ message: 'No questions found with the provided IDs.' });
    }

    const updateFields = {};

    // Handle topic update
    if (topic && topic.length > 0) {
      updateFields.topics = topic; // Set topics to the provided value
      updateFields.subtopics = []; // Clear subtopics if topics are being updated
    }

    // Handle subtopic update
    if (subtopic && subtopic.length > 0) {
      updateFields.subtopics = subtopic; // Update subtopics
    }

    console.log('Update fields:', updateFields); // Log update fields for debugging

    // Perform the update
    const result = await Ques.updateMany(
      { _id: { $in: ids } },
      { $set: updateFields }
    );

    // Check if any documents were matched and modified
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No questions found with the provided IDs.' });
    }

    if (result.modifiedCount > 0) {
      return res.status(200).json({ message: 'Questions updated successfully.' });
    } else {
      return res.status(200).json({ message: 'Questions found but nothing was updated because the data was the same.' });
    }
  } catch (error) {
    console.error('Error updating questions:', error);
    res.status(500).json({ message: 'An error occurred while updating questions.' });
  }
};


