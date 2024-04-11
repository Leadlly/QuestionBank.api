import { Subject } from "../model/subjectModel.js";

export const createSubject = async (req, res) => {
  try {
    const { subjectName, standard, chapters } = req.body;

    const existingSubject = await Subject.findOne({
      name: subjectName,
      standard,
    });
    if (existingSubject) {
      return res
        .status(400)
        .json({ success: false, message: "Subject already exists" });
    }

    const sub = await Subject.create({
      name: subjectName,
      standard,
      chapters,
    });

    res.status(201).json({
      success: true,
      message: "Subject Created",
      sub,
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

export const createChapter = async (req, res) => {
  try {
    const { subjectName, standard, chapters } = req.body;
    const existingSubject = await Subject.findOne({
      name: subjectName,
      standard,
    });
    if (!existingSubject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    existingSubject.chapters.push(...chapters);
    await existingSubject.save();
    res
      .status(201)
      .json({ success: true, message: "Chapter and topics added to subject" });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Internal Server Error",
      });
  }
};

export const createTopic = async (req, res) => {
  try {
    const { subjectName, chapterName, topics, standard } = req.body;

    // Find the subject by name and standard
    const existingSubject = await Subject.findOne({ name: subjectName, standard });
    if (!existingSubject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    // Find the chapter by name within the found subject
    const existingChapter = existingSubject.chapters.find(chapter => chapter.name === chapterName);
    if (!existingChapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    // Checking if topic already exists
    const existingTopics = topics.filter(topic => existingChapter.topics.some(existingTopic => existingTopic.name === topic.name));
    if (existingTopics.length > 0) {
      return res.status(400).json({ success: false, message: "Topics already exist" });
    }


     // Check if any of the nested subtopics already exist within the existing topics
     const checkNestedSubtopics = (existingTopics, newTopics) => {
      for (let existingTopic of existingTopics) {
        for (let newTopic of newTopics) {
          if (newTopic.name === existingTopic.name) {
            return true;
          }
          if (newTopic.subtopics && existingTopic.subtopics) {
            if (checkNestedSubtopics(existingTopic.subtopics, newTopic.subtopics)) {
              return true;
            }
          }
        }
      }
      return false;
    };

    if (checkNestedSubtopics(existingChapter.topics, topics)) {
      return res.status(400).json({ success: false, message: "One or more subtopics already exist" });
    }

    existingChapter.topics.push(...topics);

    // Save the updated subject document
    await existingSubject.save();

    res.status(201).json({ success: true, message: "Topic(s) added to chapter" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};


export const createSubTopic = async (req, res) => {
  try {
    const { subjectName, chapterName, topicName, subtopics, standard } = req.body;

    // Find the subject by name and standard
    const existingSubject = await Subject.findOne({ name: subjectName, standard });
    if (!existingSubject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    // Find the chapter by name within the found subject
    const existingChapter = existingSubject.chapters.find(chapter => chapter.name === chapterName);
    if (!existingChapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    // Find the topic by name within the found chapter
    const existingTopic = existingChapter.topics.find(topic => topic.name === topicName);
    if (!existingTopic) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    const existingSubtopics = existingTopic.subtopics;

    // Check for duplicate subtopics
    const duplicateSubtopics = subtopics.filter(subtopic => existingSubtopics.includes(subtopic));
    if (duplicateSubtopics.length > 0) {
      return res.status(400).json({ success: false, message: "Duplicate subtopics found" });
    }

    // Check for nested subtopics
    const checkNestedSubtopics = (existingSubtopics, newSubtopics) => {
      for (let existingSubtopic of existingSubtopics) {
        for (let newSubtopic of newSubtopics) {
          if (newSubtopic.name === existingSubtopic.name) {
            return true;
          }
          if (newSubtopic.subtopics && existingSubtopic.subtopics) {
            if (checkNestedSubtopics(existingSubtopic.subtopics, newSubtopic.subtopics)) {
              return true;
            }
          }
        }
      }
      return false;
    };

    if (checkNestedSubtopics(existingSubtopics, subtopics)) {
      return res.status(400).json({ success: false, message: "One or more subtopics already exist" });
    }

    existingTopic.subtopics.push(...subtopics);

    // Save the updated subject document
    await existingSubject.save();

    res.status(201).json({ success: true, message: "Subtopic(s) added to topic" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
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
export const getChapter = async (req, res) => {
  try {
    const subject = await Subject.findOne({
      name: req.query.subjectName,
      standard: req.query.standard,
    });

    const chapters = subject.chapters?.map((chapter) => chapter?.name);

    res.status(200).json({
      success: true,
      chapters,
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

export const getTopic = async (req, res) => {
  try {
    const subject = await Subject.findOne({
      name: req.query.subjectName,
      standard: req.query.standard,
    });

    const chapter = subject.chapters.find(
      (chapter) => chapter.name === req.query.chapterName,
    );
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    const topics = chapter.topics?.map((topic) => topic);

    res.status(200).json({
      success: true,
      topics,
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

export const getSubTopic = async (req, res) => {
  try {

    const {subjectName, standard, chapterName, topicName} = req.query
    const subject = await Subject.findOne({
      name: subjectName,
      standard: standard,
    });

    const chapter = subject.chapters.find(
      (chapter) => chapter.name === chapterName,
    );
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    const topics = chapter.topics.find((topic) => topic.name === topicName);
    if (!topics) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }

    const subtopics = topics.subtopics?.map(subtopic => subtopic)

    res.status(200).json({
      success: true,
      subtopics,
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
