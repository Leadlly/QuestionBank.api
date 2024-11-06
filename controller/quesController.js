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

    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;
    if (req.query.chapterId) {
      queryObject.chaptersId = { $in: [new mongoose.Types.ObjectId(req.query.chapterId.trim())] };
    }
    if (req.query.topicId) queryObject.topicsId = { $in: [new mongoose.Types.ObjectId(req.query.topicId)] };
    if (req.query.subtopics) queryObject.subtopics = req.query.subtopics;
    if (req.query.createdBy) queryObject.createdBy = req.query.createdBy;

    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));
      queryObject.$and = [{ $or: searchRegex.map(regex => ({ question: regex })) }];
    }

    if (req.query.isTagged) {
      if (req.query.isTagged === 'tagged') {
        queryObject.$or = [
          { topics: { $exists: true, $ne: [] } },  
          { subtopics: { $exists: true, $ne: [] } }
        ];
      } else if (req.query.isTagged === 'untagged') {
        queryObject.$and = [
          { $or: [{ topics: { $size: 0 } }, { topics: { $exists: false } }] },  
          { $or: [{ subtopics: { $size: 0 } }, { subtopics: { $exists: false } }] } 
        ];
      }
    }


    console.log("Query Object:", queryObject);

    let formattedQuestions = [];

    if (req.user.role === "admin") {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const questionsData = Ques.find(queryObject)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);
      const questions = await questionsData;

      if (!questions || questions.length === 0) {
        return res.status(404).json({ success: false, message: "Questions not found" });
      }

      formattedQuestions = questions.map(question => ({
        ...question.toObject(),
        nestedSubTopic: question.nestedSubTopic || ""
      }));

      const totalQuestions = await Ques.countDocuments(queryObject);
      let totalTagged = 0;
      let totalUntagged = 0;
      // Get counts based on the isTagged parameter
      if (req.query.isTagged === 'tagged') {
        totalTagged = totalQuestions;
      } else if (req.query.isTagged === 'untagged') {
        totalUntagged = totalQuestions;
      } else {
        totalTagged = await Ques.countDocuments({
          $or: [
            { topics: { $exists: true, $ne: [] } },
            { subtopics: { $exists: true, $ne: [] } }
          ]
        });

        totalUntagged = await Ques.countDocuments({
          $and: [
            { $or: [{ topics: { $size: 0 } }, { topics: { $exists: false } }] },
            { $or: [{ subtopics: { $size: 0 } }, { subtopics: { $exists: false } }] }
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
    if (req.query.topicId) queryObject.topicsId = { $in: [new mongoose.Types.ObjectId(req.query.topicId)] };
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
        { createdBy: userId }
      ];
    }
    const taggedQuery = {
      ...queryObject,
      $or: [
        { topics: { $exists: true, $ne: [] } },
        { subtopics: { $exists: true, $ne: [] } },
      ],
    };
    const untaggedQuery = {
      ...queryObject,
      topics: { $exists: true, $size: 0 },
      subtopics: { $exists: true, $size: 0 },
    };

    let totalQuestions = await Ques.countDocuments(queryObject);
    if (req.query.isTagged === 'tagged') {
      totalQuestions = await Ques.countDocuments(taggedQuery);
    } else if (req.query.isTagged === 'untagged') {
      totalQuestions = await Ques.countDocuments(untaggedQuery);
    }

    const userQuery = { ...queryObject, createdBy: userId };
    let totalMyQuestions = await Ques.countDocuments(userQuery);
    
    const myTaggedQuery = {
      ...userQuery,
      $or: [
        { topics: { $exists: true, $ne: [] } },
        { subtopics: { $exists: true, $ne: [] } },
      ],
    };
    const myUntaggedQuery = {
      ...userQuery,
      topics: { $exists: true, $size: 0 },
      subtopics: { $exists: true, $size: 0 },
    };

    const totalMyTagged = await Ques.countDocuments(myTaggedQuery);
    const totalMyUntagged = await Ques.countDocuments(myUntaggedQuery);
    if (req.query.isTagged === 'tagged') {
      totalMyQuestions = await Ques.countDocuments(myTaggedQuery);
    } else if (req.query.isTagged === 'untagged') {
      totalMyQuestions = await Ques.countDocuments(myUntaggedQuery);
    }

    const fixedTotalQuestions = await Ques.countDocuments();

    const totalPages = Math.ceil(totalQuestions / req.query.questionsPerPage);
    const totalMyPages = Math.ceil(totalMyQuestions / req.query.questionsPerPage);

    return res.status(200).json({
      success: true,
      totalQuestions,
      totalTagged: await Ques.countDocuments(taggedQuery),
      totalUntagged: await Ques.countDocuments(untaggedQuery),
      fixedTotalQuestions,
      totalMyQuestions,
      totalMyTagged,
      totalMyUntagged,
      totalPages,
      totalMyPages,
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

    queryObject.createdBy = req.user._id;

    if (req.query.standard) queryObject.standard = req.query.standard;
    if (req.query.subject) queryObject.subject = req.query.subject;
    if (req.query.chapterId) {
      queryObject.chaptersId = { $in: [new mongoose.Types.ObjectId(req.query.chapterId.trim())] };
    }
    if (req.query.topicId) queryObject.topicsId = { '$in': [new mongoose.Types.ObjectId(req.query.topicId)] };
    if (req.query.subtopics) queryObject.subtopics = req.query.subtopics;

    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term !== '');
      const searchRegex = searchTerms.map(term => new RegExp(term, 'i'));
      queryObject.$and = [{ $or: searchRegex.map(regex => ({ question: regex })) }];
    }

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

    let page = req.query.page || 1;
    let limit = req.query.limit || 50;
    let skip = (page - 1) * limit;

    let questionsData = Ques.find(queryObject).sort({ createdAt: 1 }).skip(skip).limit(limit);
    const questions = await questionsData;

    if (!questions || questions.length === 0) {
      return res.status(404).json({ success: false, message: "Questions not found" });
    }

    const formattedQuestions = questions.map(question => ({
      ...question.toObject(),
      nestedSubTopic: question.nestedSubTopic || ""
    }));

    const totalQuestions = await Ques.countDocuments(queryObject);

    let totalMyTagged = 0;
    let totalMyUntagged = 0;

    if (req.query.isTagged === 'tagged') {
      totalMyTagged = totalQuestions; // Use the total questions count if filtering for tagged
    } else if (req.query.isTagged === 'untagged') {
      totalMyUntagged = totalQuestions; // Use the total questions count if filtering for untagged
    } else {
      // Get overall counts for the current user's questions
      totalMyTagged = await Ques.countDocuments({
        createdBy: req.user._id,
        $or: [
          { topics: { $exists: true, $ne: [] } },
          { subtopics: { $exists: true, $ne: [] } }
        ]
      });

      totalMyUntagged = await Ques.countDocuments({
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
      totalQuestions, 
      totalMyTagged,
      totalMyUntagged,
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