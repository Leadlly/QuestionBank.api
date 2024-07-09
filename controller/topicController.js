import { Topic } from "../model/topicModel.js";
import { Subject } from "../model/subjectModel.js";


export const createTopic = async (req, res) => {
  try {


    console.log(req.body)
    const { subjectName, standard, chapterName, topics } = req.body;

    if (!subjectName || !chapterName || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ success: false, message: 'Subject name, chapter name, and topics (array) must be provided' });
    }

    const existingSubject = await Subject.findOne({ name: subjectName, standard })
      .populate({
        path: 'chapters',
        populate: { path: 'topics' }
      });

    console.log(existingSubject)

    if (!existingSubject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const existingChapter = existingSubject.chapters.find(chapter => chapter.name === chapterName);
    if (!existingChapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const existingTopicNames = new Set(existingChapter.topics.map(topic => topic.name));


    for (const topic of topics) {

      if (!topic.name || typeof topic.name !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid topic name' });
      }

      const topicName = topic.name.trim();

      if (existingTopicNames.has(topicName)) {
        return res.status(400).json({ success: false, message: `Topic "${topicName}" already exists in the chapter` });
      }

      existingTopicNames.add(topicName);
    }

    const newTopics = [];
    for (const topic of topics) {
      const newTopic = new Topic({ name: topic.name, chapterName, subjectName, standard });

      await newTopic.save();

      existingChapter.topics.push(newTopic._id);

      newTopics.push(newTopic);
    }

    await existingChapter.save();

    res.status(200).json({ success: true, message: 'Topics created and added to chapter successfully', newTopics });

  } catch (error) {
    console.error('Error in createTopic:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
};





export const getTopic = async (req, res) => {
  try {
    const { subjectName, standard, chapterName } = req.query;

    let filter = {};

    if (subjectName) {
      filter.subject = subjectName;
    }

    if (standard) {
      filter.standard = standard;
    }

    if (chapterName) {
      const chapterNameArray = chapterName.split(',').map(name => name.trim());
      filter.chapters = { $elemMatch: { name: { $in: chapterNameArray } } };
    }

    const topics = await Topic.find(filter)
      .populate({
        path: 'subtopics',
      });

    if (topics.length === 0) {
      return res.status(404).json({ success: false, message: 'No topics found' });
    }

    return res.status(200).json({ success: true, topics, exam: topics.exam });
  } catch (error) {
    console.error('Error in getTopic:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

export const getTopicById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Topic ID must be provided' });
    }

    const topic = await Topic.findById(id)
      .populate({
        path: 'subtopics', // Populate subtopics for the topic
      });

    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    return res.status(200).json({ success: true, topic });
  } catch (error) {
    console.error('Error in getTopicById:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

export const updateTopicExamTags = async (req, res) => {
  try {
    const topicId = req.params.id;
    const updatedExamTags = req.body.examTags;

    if (!updatedExamTags || !Array.isArray(updatedExamTags)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exam tags. Must be an array.',
      });
    }

    const topic = await Topic.findByIdAndUpdate(topicId, {
      $addToSet: { exam: { $each: updatedExamTags } },
    }, { new: true });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Exam tags updated successfully',
      topic: topic,
    });
  } catch (error) {
    console.error('Error updating exam tags:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};



