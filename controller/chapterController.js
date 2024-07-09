import { Chapter } from "../model/chapterModel.js";
import { Subject } from "../model/subjectModel.js"
import { Topic } from "../model/topicModel.js"



export const createChapter = async (req, res) => {
  try {
    const { subject } = req.body;
    const { name, standard, chapters } = subject || {};

    if (!name || !Array.isArray(chapters)) {
      return res.status(400).json({ success: false, message: 'Subject name and chapters (array) must be provided.' });
    }

    const existingSubject = await Subject.findOne({ name, standard }).populate('chapters'); // Ensure to populate the chapters

    if (existingSubject) {
      for (const chapterData of chapters) {
        const { name: chapterName, topics } = chapterData;

        const existingChapter = existingSubject.chapters.find(
          chapter => chapter.name === chapterName
        );

        if (existingChapter) {
          return res.status(400).json({ success: false, message: `Chapter "${chapterName}" already exists.` });
        }

        const newChapter = new Chapter({ name: chapterName, subjectName: name, standard });

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

      return res.status(201).json({ success: true, message: 'Chapters added successfully.', chapters });
    } else {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
  } catch (error) {
    console.error('Error creating chapter:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
};









export const getChapter = async (req, res) => {
  try {
    const subjectName = (req.query.subjectName || req.body.subjectName || '').trim();
    const standard = (req.query.standard || req.body.standard || '').trim();

    let filter = {};

    if (subjectName) {
      filter.subjectName = { $regex: new RegExp(`^${subjectName}$`, 'i') };
    }

    if (standard) {
      filter.standard = { $regex: new RegExp(`^${standard}$`, 'i') };
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

