import { Ques } from "../model/quesModel.js";
import { Chapter } from "../model/chapterModel.js";
import { Topic } from "../model/topicModel.js";
import { Subtopic } from "../model/subtopicModel.js";
import { body, validationResult } from "express-validator";
import processImages from "../helper/processImages.js";
import { User } from "../model/userModel.js";
import deleteImages from "../helper/deleteImages.js";
import mongoose from 'mongoose';
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

    // Process images if needed
    const imageUrls = await processImages(data.images);

    // Process options with image handling
    const options = await Promise.all(
      data.options.map(async (option) => {
        let optionImageUrls = [];
        if (option.image && Array.isArray(option.image) && option.image.length > 0) {
          optionImageUrls = await processImages(option.image);
        }

        return {
          image: optionImageUrls,
          optionDb: {
            name: option.name,
            tag: option.isCorrect === true ? "Correct" : "Incorrect",
            images: optionImageUrls.length > 0 
              ? optionImageUrls.map((image) => ({ url: image?.getUrl, key: image?.key })) 
              : null,
          },
        };
      })
    );

    const optionsSignedUrls = options.flatMap(option =>
      option.image ? option.image.map(image => image.putUrl) : []
    );

    // Ensure at least one correct option exists
    const hasCorrectOption = options.some(
      (option) => option.optionDb.tag === 'Correct'
    );
    if (!hasCorrectOption) {
      return res.status(400).json({
        success: false,
        message: 'At least one option must be correct',
      });
    }

    // Convert chapterId, topicsId, subtopicsId to ObjectId
    const chaptersId = data.chapter?.map(el => new mongoose.Types.ObjectId(el._id));
    const topicsId = data.topics?.map(el => new mongoose.Types.ObjectId(el._id));
    const subtopicsId = data.subtopics?.map(el => new mongoose.Types.ObjectId(el._id));

    const newQuestion = new Ques({
      question: data.question,
      options: options.map((option) => option.optionDb),
      standard: data.standard,
      subject: data.subject,
      chapter: data.chapter?.map(el => el.name),
      topics: data.topics?.map(el => el.name),
      subtopics: data.subtopics?.map(el => el.name),
      chaptersId: chaptersId,
      topicsId: topicsId,
      subtopicsId: subtopicsId,
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

    // Apply filters from query parameters
    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;

    if (req.query.chapterId) {
      queryObject.chaptersId = { $in: [new mongoose.Types.ObjectId(req.query.chapterId.trim())] };
    }
    if (req.query.topicId) queryObject.topicsId = { '$in': [new mongoose.Types.ObjectId(req.query.topicId)] };
    if (req.query.subtopics) queryObject.subtopics = req.query.subtopics;
    if (req.query.createdBy) queryObject.createdBy = req.query.createdBy;

    // Handle search query if provided
    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));
      queryObject.$and = [{ $or: searchRegex.map(regex => ({ question: regex })) }];
    }

    // Handle the isTagged filter
    if (req.query.isTagged) {
      if (req.query.isTagged === 'tagged') {
        queryObject.$or = [
          { topics: { $ne: null } },
          { subtopics: { $ne: null } }
        ];
      } else if (req.query.isTagged === 'untagged') {
        queryObject.$or = [
          { topics: null },
          { subtopics: null }
        ];
      }
    }

    console.log("Query Object:", queryObject);

    let formattedQuestions = [];

    if (req.user.role === "admin") {
      // Setup pagination
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 50;
      let skip = (page - 1) * limit;

      // Fetch questions based on the queryObject
      let questionsData = Ques.find(queryObject).sort({ createdAt: 1 }).skip(skip).limit(limit);
      const questions = await questionsData;

      if (!questions || questions.length === 0) {
        return res.status(404).json({ success: false, message: "Questions not found" });
      }

      formattedQuestions = questions.map(question => ({
        ...question.toObject(),
        nestedSubTopic: question.nestedSubTopic || ""
      }));

      // Get the count of total questions based on the current queryObject
      const totalQuestions = await Ques.countDocuments(queryObject);

      // Get counts based on the isTagged parameter
      let totalTagged = 0;
      let totalUntagged = 0;

      if (req.query.isTagged === 'tagged') {
        totalTagged = totalQuestions;
      } else if (req.query.isTagged === 'untagged') {
        totalUntagged = totalQuestions;
      } else {
        totalTagged = await Ques.countDocuments({
          $or: [
            { topics: { $ne: null } },
            { subtopics: { $ne: null } }
          ]
        });

        totalUntagged = await Ques.countDocuments({
          $or: [
            { topics: null },
            { subtopics: null }
          ]
        });
      }

      return res.status(200).json({
        success: true,
        totalQuestions,
        totalTagged,
        totalUntagged,
        questions: formattedQuestions,
      });
    }

    return res.status(403).json({ success: false, message: "Unauthorized" });
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
    if (req.query.chapterId) {
      queryObject.chaptersId = { $in: [new mongoose.Types.ObjectId(req.query.chapterId.trim())] };
    }

    if (req.query.topicId) queryObject.topicsId = { '$in': [new mongoose.Types.ObjectId(req.query.topicId)] };
    if (req.query.subtopics) queryObject.subtopics = req.query.subtopics;
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

    if (req.query.isTagged) {
      if (req.query.isTagged === 'tagged') {
        queryObject.$or = [
          { topics: { $ne: null } },  // Topic exists
          { subtopics: { $ne: null } }  // Subtopic exists
        ];
      } else if (req.query.isTagged === 'untagged') {
        queryObject.$or = [
          { topics: null },
          { subtopics: null },
          {
            $and: [
              { topics: { $exists: true } },
              { subtopics: { $exists: true } },
              { topics: { $type: "array" } },
              { subtopics: { $type: "array" } },
              { $expr: { $and: [{ $eq: [{ $size: "$topics" }, 0] }, { $eq: [{ $size: "$subtopics" }, 0] }] } }
            ]
          }
        ];
      }
    }

    // Fetch total questions based on the constructed query
    const totalQuestions = await Ques.countDocuments(queryObject);

    // Calculate total tagged and untagged questions (separate logic)
    const taggedQueryObject = { $or: [
      { topics: { $exists: true, $ne: [] } },
      { subtopics: { $exists: true, $ne: [] } }
    ]};

    const untaggedQueryObject = { $and: [
      { topics: { $size: 0 } },
      { subtopics: { $size: 0 } }
    ]};

    // Calculate total tagged and untagged questions
    const totalTagged = await Ques.countDocuments(taggedQueryObject);
    const totalUntagged = await Ques.countDocuments(untaggedQueryObject);

    // If `isTagged` is present, set total questions to the respective count
    let total = totalQuestions;
    if (req.query.isTagged === 'tagged') {
      total = totalTagged;
    } else if (req.query.isTagged === 'untagged') {
      total = totalUntagged;
    }

    // Fetch the logged-in user's questions (if applicable)
    const queryObjects = { ...queryObject, createdBy: userId };
    const myQuestions = await Ques.find(queryObjects);
    const questionsLength = myQuestions.length;
    const totalMyQuestions = await Ques.countDocuments({ createdBy: userId });
    const totalMyPages = Math.ceil(totalMyQuestions / req.query.questionsPerPage);

    // Fetch fixed total questions (all questions, no filters)
    const fixedTotalQuestions = await Ques.countDocuments({});

    // Calculate total pages based on questions per page
    const totalPages = Math.ceil(total / req.query.questionsPerPage);

    // Send the response
    return res.status(200).json({
      success: true,
      totalQuestions: total,  // Adjusted to reflect either tagged or untagged
      totalTagged: totalTagged,
      totalUntagged: totalUntagged,
      questionsLength: questionsLength,
      fixedTotalQuestions: fixedTotalQuestions,
      totalMyQuestions: totalMyQuestions,
      totalPages: totalPages,
      totalMyPages: totalMyPages
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
    const queryObject = {};

    // Only fetch questions created by the current user
    queryObject.createdBy = req.user._id;

    // Apply additional filters from query parameters
    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;
    if (req.query.chapterId) {
      queryObject.chaptersId = { $in: [new mongoose.Types.ObjectId(req.query.chapterId.trim())] };
    }
    if (req.query.topicId) queryObject.topicsId = { '$in': [new mongoose.Types.ObjectId(req.query.topicId)] };
    if (req.query.subtopics) queryObject.subtopics = req.query.subtopics;

    // Handle search query if provided
    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));
      queryObject.$and = [{ $or: searchRegex.map(regex => ({ question: regex })) }];
    }

    // Handle the isTagged filter
    if (req.query.isTagged) {
      if (req.query.isTagged === 'tagged') {
        queryObject.$or = [
          { topics: { $exists: true, $ne: [] } },
          { subtopics: { $exists: true, $ne: [] } }
        ];
      } else if (req.query.isTagged === 'untagged') {
        queryObject.$and = [
          { $or: [
              { topics: { $exists: false } },
              { topics: { $exists: true, $eq: [] } }
            ]
          },
          { $or: [
              { subtopics: { $exists: false } },
              { subtopics: { $exists: true, $eq: [] } }
            ]
          }
        ];
      }
    }

    // Pagination setup
    let page = req.query.page || 1;
    let limit = req.query.limit || 50;
    let skip = (page - 1) * limit;

    // Fetch questions created by the current user based on the queryObject
    let questionsData = Ques.find(queryObject).sort({ createdAt: 1 }).skip(skip).limit(limit);
    const questions = await questionsData;

    if (!questions || questions.length === 0) {
      return res.status(404).json({ success: false, message: "Questions not found" });
    }

    const formattedQuestions = questions.map(question => ({
      ...question.toObject(),
      nestedSubTopic: question.nestedSubTopic || ""
    }));

    // Get the count of total questions for the current user
    const totalQuestions = await Ques.countDocuments(queryObject);

    // Get counts for tagged and untagged questions
    let totalTagged = 0;
    let totalUntagged = 0;

    if (req.query.isTagged === 'tagged') {
      totalTagged = totalQuestions; // Use the total questions count if filtering for tagged
    } else if (req.query.isTagged === 'untagged') {
      totalUntagged = totalQuestions; // Use the total questions count if filtering for untagged
    } else {
      // Get overall counts for the current user's questions
      totalTagged = await Ques.countDocuments({
        createdBy: req.user._id,
        $or: [
          { topics: { $exists: true, $ne: [] } },
          { subtopics: { $exists: true, $ne: [] } }
        ]
      });

      totalUntagged = await Ques.countDocuments({
        createdBy: req.user._id,
        $and: [
          { $or: [
              { topics: { $exists: false } },
              { topics: { $exists: true, $eq: [] } }
            ]
          },
          { $or: [
              { subtopics: { $exists: false } },
              { subtopics: { $exists: true, $eq: [] } }
            ]
          }
        ]
      });
    }

    return res.status(200).json({
      success: true,
      totalQuestions, // This reflects the filtered questions created by the current user
      totalTagged,
      totalUntagged,
      questions: formattedQuestions,
    });
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
    const { standard, subject, chapter, topics, subtopics, level } = req.body;

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

      if (level) {
        question.level = level;
      } else {
        question.level = [];
      }
    } else {
      if (standard) question.standard = standard;
      if (chapter) {
        question.chapter = chapter?.map(el => el.name);
        question.chaptersId = chapter?.map(el => new mongoose.Types.ObjectId(el._id));
      }
      if (topics) {
        question.topics = topics?.map(el => el.name);
        question.topicsId = topics?.map(el => new mongoose.Types.ObjectId(el._id));
      }
      if (subtopics){
         question.subtopics = subtopics?.map(el => el.name);
         question.subtopicsId = subtopics?.map(el => new mongoose.Types.ObjectId(el._id));
        }
      if (level) question.level = level;
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

export const checkIfTagged = async (req, res) => {
  try {
    const { id } = req.params; // Get question ID from request parameters

    const question = await Ques.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    // Check if topics or subtopics exist
    const isTagged = (question.topics && question.topics.length > 0) || 
                     (question.subtopics && question.subtopics.length > 0);

    res.status(200).json({
      success: true,
      questionId: id,
      status: isTagged ? 'Tagged' : 'Untagged',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};