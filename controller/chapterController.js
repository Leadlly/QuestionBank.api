import { Chapter } from "../model/chapterModel.js";
import { Ques } from "../model/quesModel.js";
import { Subject } from "../model/subjectModel.js"
import { Subtopic } from "../model/subtopicModel.js";
import { Topic } from "../model/topicModel.js"



export const createChapter = async (req, res) => {
  try {
    const { subject } = req.body;
    const { name, standard, chapters } = subject || {};

    if (!name || !Array.isArray(chapters)) {
      return res.status(400).json({ success: false, message: 'Subject name and chapters (array) must be provided.' });
    }

    const existingSubject = await Subject.findOne({ name, standard });

    if (!existingSubject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    for (const chapterData of chapters) {
      const { name: chapterName, chapterNumber, topics } = chapterData;

      const existingChapterByName = await Chapter.findOne({
        name: chapterName,
        standard,
        subjectName: name,
      });

      if (existingChapterByName) {
        return res.status(400).json({ success: false, message: `Chapter with name "${chapterName}" already exists.` });
      }

      const existingChapterByNumber = await Chapter.findOne({
        chapterNumber,
        standard,
        subjectName: name,
      });

      if (existingChapterByNumber) {
        return res.status(400).json({ success: false, message: `Chapter number "${chapterNumber}" already exists.` });
      }

      const newChapter = new Chapter({
        name: chapterName,
        subjectName: name,
        standard,
        chapterNumber,
      });

      if (Array.isArray(topics)) {
        for (const topicName of topics) {
          const newTopic = new Topic({ name: topicName, subjectName: name, chapterName, standard });
          await newTopic.save();
          newChapter.topics.push(newTopic._id);
        }
      }

      await newChapter.save();
      existingSubject.chapters.push(newChapter._id);
    }

    await existingSubject.save();

    return res.status(201).json({ success: true, message: 'Chapters added successfully.' });
  } catch (error) {
    console.error('Error creating chapter:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
};




export const getChapter = async (req, res) => {
  try {
    const subjectName = (req.query.subjectName || req.body.subjectName || '').trim();
    const standard = req.query.standard || req.body.standard;
    const parsedStandard = parseInt(standard, 10);

    let filter = {};

    if (subjectName) {
      filter.subjectName = { $regex: new RegExp(`^${subjectName}$`, 'i') };
    }

    if (!isNaN(parsedStandard)) {
      filter.standard = parsedStandard;
    }

    const chapters = await Chapter.aggregate([
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: 'chapters',
          as: 'subject',
        },
      },
      {
        $match: filter,
      },
      {
        $unwind: '$subject',
      },
      {
        $lookup: {
          from: 'topics',
          localField: '_id',
          foreignField: 'chapter',
          as: 'topics',
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      chapters: chapters.map(chapter => ({
        _id: chapter._id,
        name: chapter.name,
        chapterNumber: chapter.chapterNumber, // Include chapterNumber
        topics: chapter.topics,
        exam: chapter.exam,
      })),
    });
  } catch (error) {
    console.error('Error in getChapters:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
};


export const getChapterById = async (req, res) => {
  try {
    const chapterId = req.params.id;

    if (!chapterId) {
      return res.status(400).json({
        success: false,
        message: 'Chapter ID is required',
      });
    }

    const chapter = await Chapter.findById(chapterId)
      .populate('subjectName')
      .populate('topics');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found',
      });
    }

    return res.status(200).json({
      success: true,
      chapter: {
        _id: chapter._id,
        name: chapter.name,
        standard: chapter.standard,
        subject: chapter.subjectName,
        topics: chapter.topics,
        exam: chapter.exam
      },
    });
  } catch (error) {
    console.error('Error in getChapterById:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
};

export const getChaptersByIds = async (req, res) => {
  try {
    const {chapterIds} = req.body;
    if(!chapterIds) return res.status(400).json({success: false, message: "Please provide chapterids"})
    const chapters = []

    for (let chapterId of chapterIds) {
      if (!chapterId) {
        return res.status(400).json({
          success: false,
          message: 'Chapter ID is required',
        });
      }
  
      const chapter = await Chapter.findById(chapterId)
        .populate('subjectName')
        .populate('topics');
  
      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: 'Chapter not found',
        });
      }
  
      chapters.push(chapter)
      
    }

    return res.status(200).json({
      success: true,
      chapters
    });
  
  } catch (error) {
    console.error('Error in getChapterById:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
};
export const updateChapterExamTags = async (req, res) => {
  
  try {
    const chapterId = req.params.id;
    const updatedExamTags = req.body.examTags;

    if (!updatedExamTags || !Array.isArray(updatedExamTags)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exam tags. Must be an array.',
      });
    }

    const chapter = await Chapter.findByIdAndUpdate(chapterId, {
      $set: { exam: updatedExamTags },
    }, { new: true });

    console.log(chapter); 

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Exam tags updated successfully',
      chapter: chapter,
    });
  } catch (error) {
    console.error('Error updating exam tags:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};

export const updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, chapterNumber } = req.body;

    if (!id || !name || chapterNumber === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Chapter ID, new name, and chapter number must be provided.' 
      });
    }

    const chapter = await Chapter.findById(id);

    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found.' });
    }

    const { subjectName, standard } = chapter; // Use current chapter's subject and standard for validation

    // Check for duplicate chapter name in the same subject and standard
    const existingChapterByName = await Chapter.findOne({
      name,
      standard,
      subjectName,
      _id: { $ne: id }, // Exclude the current chapter from the check
    });

    if (existingChapterByName) {
      return res.status(400).json({ success: false, message: `Chapter with name "${name}" already exists.` });
    }

    // Check for duplicate chapter number in the same subject and standard
    const existingChapterByNumber = await Chapter.findOne({
      chapterNumber,
      standard,
      subjectName,
      _id: { $ne: id }, // Exclude the current chapter from the check
    });

    if (existingChapterByNumber) {
      return res.status(400).json({ success: false, message: `Chapter number "${chapterNumber}" already exists.` });
    }

    // Update Chapter details
    const oldName = chapter.name;
    chapter.name = name;
    chapter.chapterNumber = chapterNumber;
    await chapter.save();

    // Update related collections
    await Topic.updateMany(
      { chapterName: oldName, subjectName, standard },
      { $set: { chapterName: name, chapterNumber } }
    );

    await Subtopic.updateMany(
      { chapterName: oldName, subjectName, standard },
      { $set: { chapterName: name, chapterNumber } }
    );

    return res.status(200).json({
      success: true,
      message: 'Chapter name and chapter number updated successfully in all relevant collections.',
    });
  } catch (error) {
    console.error('Error in updateChapter:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An unexpected error occurred. Please try again later.',
    });
  }
};






export const deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Chapter ID must be provided' });
    }

    // Find the chapter by its ID
    const chapter = await Chapter.findById(id);

    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    // Check if there are any questions associated with the chapter
    const associatedQuestionsCount = await Ques.countDocuments({ chapters: chapter.name });

    // Check if there are any topics associated with the chapter
    const associatedTopicsCount = await Topic.countDocuments({ chapterName: chapter.name });

    if (associatedQuestionsCount > 0 || associatedTopicsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Chapter "${chapter.name}" cannot be deleted because it is associated with ${associatedQuestionsCount} question(s) and ${associatedTopicsCount} topic(s).`,
      });
    }

    // Delete the chapter from the Chapter collection
    await Chapter.findByIdAndDelete(id);

    // Remove the chapter ID from the associated subjects
    await Subject.updateMany(
      { chapters: id },
      { $pull: { chapters: id } }
    );

    return res.status(200).json({
      success: true,
      message: 'Chapter deleted successfully and removed from all related subjects',
    });
  } catch (error) {
    console.error('Error in deleteChapter:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};


export const chapterNumberUpdate = async (req, res) => {
  try {
    const { chapterId, subjectName, chapterNumber } = req.body;

    // Validate input
    if (!chapterId || !subjectName || chapterNumber === undefined) {
      return res.status(400).json({ message: "chapterId, subjectName, and chapterNumber are required." });
    }

    // Check if the chapterNumber is already used in the given subject
    const existingChapter = await Chapter.findOne({
      subjectName,
      chapterNumber,
    });

    if (existingChapter) {
      return res.status(400).json({
        message: `Chapter number ${chapterNumber} is already assigned to chapter in the subject "${subjectName}".`,
      });
    }

    // Update the chapter with the new chapter number
    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      { chapterNumber: chapterNumber || null },
      { new: true, runValidators: true }
    );

    if (!updatedChapter) {
      return res.status(404).json({ message: "Chapter not found." });
    }

    res.status(200).json({
      message: "Chapter number updated successfully.",
      chapter: updatedChapter,
    });
  } catch (error) {
    console.error("Error updating chapter number:", error);
    res.status(500).json({
      message: "An error occurred while updating the chapter number.",
      error: error.message,
    });
  }
};