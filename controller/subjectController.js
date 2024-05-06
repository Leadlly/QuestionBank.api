import { Subject } from "../model/subjectModel.js";
import { Topic } from "../model/topicModel.js";
import { Chapter } from "../model/chapterModel.js";



export const createSubject = async (req, res) => {
  try {

      const { subject } = req.body;
      const { name: subjectName, standard, chapters } = subject || {};

      if (!subjectName || !standard) {
          return res.status(400).json({ success: false, message: 'Subject name and standard are required.' });
      }

      if (!Array.isArray(chapters)) {
          return res.status(400).json({ success: false, message: 'Chapters must be an array.' });
      }

      const existingSubject = await Subject.findOne({
        name: subjectName,
        standard,
      });
      if (existingSubject) {
        return res
          .status(400)
          .json({ success: false, message: "Subject already exists" });
      }

      const newSubject = new Subject({
          name: subjectName,
          standard,
      });

      const chapterIds = [];

      for (const chapterData of chapters) {
          const { name: chapterName, topics } = chapterData;

          const topicIds = [];

          if (Array.isArray(topics)) {
              for (const topicName of topics) {
                  const newTopic = new Topic({ name: topicName, chapterName, subjectName, standard });
                  await newTopic.save();
                  topicIds.push(newTopic._id);
              }
          }

          const newChapter = new Chapter({
              name: chapterName,
              standard, 
              subjectName,
              topics: topicIds,
          });
          await newChapter.save();

          chapterIds.push(newChapter._id);
      }

      newSubject.chapters = chapterIds;
      await newSubject.save();

      // Return a success response
      res.status(200).json({
          success: true,
          message: 'Subject created successfully.',
          subject: newSubject,
      });
  } catch (error) {
      res.status(500).json({
          success: false,
          message: error.message || 'Internal Server Error',
      });
  }
};




export const getAllSubject = async (req, res) => {
  try {
    const subjects = await Subject.find({ standard: req.query.standard });

    const subjectList = subjects.map((subject) => subject.name);
    res.status(200).json({
      success: true,
      subjectList,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Internal Server Error",
      });
  }
};



