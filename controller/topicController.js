import { Topic } from "../model/topicModel.js";
import { Subject } from "../model/subjectModel.js";
import { Chapter } from "../model/chapterModel.js";
import {Ques} from "../model/quesModel.js";
import {Subtopic} from "../model/subtopicModel.js"


export const createTopic = async (req, res) => {
  try {
    const { subjectName, standard, chapterName, chapterId, topics } = req.body;

    // Validate that required fields are provided
    if (!subjectName || !chapterName || !chapterId || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject name, chapter name, chapterId, and topics (array) must be provided' 
      });
    }

    // Fetch the existing subject with populated chapters and topics
    const existingSubject = await Subject.findOne({ name: subjectName, standard })
      .populate({
        path: 'chapters',
        populate: { path: 'topics' }
      });

    if (!existingSubject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    // Find the specific chapter by name or ID
    const existingChapter = existingSubject.chapters.find(chapter => chapter._id.toString() === chapterId);

    if (!existingChapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    // Set of existing topic names to prevent duplicates
    const existingTopicNames = new Set(existingChapter.topics.map(topic => topic.name));

    // Validate and add new topics
    const newTopics = [];
    for (const topic of topics) {
      if (!topic.name || typeof topic.name !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid topic name' });
      }

      const topicName = topic.name.trim();

      // Check for duplicate topic names in the same chapter
      if (existingTopicNames.has(topicName)) {
        return res.status(400).json({ success: false, message: `Topic "${topicName}" already exists in the chapter` });
      }

      // Create and save new topic
      const newTopic = new Topic({ 
        name: topicName, 
        chapterName, 
        chapterId, 
        subjectName, 
        standard 
      });

      await newTopic.save();

      // Add new topic ID to chapter
      existingChapter.topics.push(newTopic._id);
      newTopics.push(newTopic);
    }

    // Save the updated chapter with new topics
    await existingChapter.save();

    res.status(200).json({ 
      success: true, 
      message: 'Topics created and added to chapter successfully', 
      newTopics 
    });

  } catch (error) {
    console.error('Error in createTopic:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
};



export const editTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Topic ID and new name must be provided' });
    }

    const topic = await Topic.findById(id);

    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    const oldName = topic.name;
    topic.name = name;
    await topic.save();

    await Ques.updateMany(
      { topics: oldName },
      { $set: { "topics.$": name } }
    );

    await Subtopic.updateMany(
      { topicName: oldName },
      { $set: { topicName: name } }
    );

    return res.status(200).json({ success: true, message: 'Topic name edited successfully in Topic, QuestionBank, and Subtopic collections' });
  } catch (error) {
    console.error('Error in editTopic:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

export const deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Topic ID must be provided' });
    }

    const topic = await Topic.findByIdAndDelete(id);

    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    // Remove topic ID from chapter's topics array
    await Chapter.updateMany({ topics: id }, { $pull: { topics: id } });

    return res.status(200).json({ success: true, message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('Error in deleteTopic:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

export const getTopic = async (req, res) => {
  try {
    const { subjectName, standard, chapterId } = req.query;

    let filter = {};

    if (subjectName) filter.subjectName = subjectName;
    if (standard) filter.standard = standard;
    if (chapterId) filter.chapterId = chapterId;  // Chapter ID filtering

    const topics = await Topic.find(filter);

    if (topics.length === 0) {
      return res.status(404).json({ success: false, message: 'No topics found' });
    }

    return res.status(200).json({ success: true, topics });
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
      $set: { exam: updatedExamTags }, 
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

export const updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Topic ID and new name must be provided' });
    }

    const topic = await Topic.findById(id);

    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    // Find the chapter associated with the topic by name and subjectName
    const existingChapter = await Chapter.findOne({
      name: topic.chapterName,
      subjectName: topic.subjectName,
    }).populate('topics');

    // Check if the chapter exists
    if (!existingChapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    // Check if the new name already exists in the same chapter
    const topicExists = existingChapter.topics.some(t => t.name === name && t._id.toString() !== id);

    if (topicExists) {
      return res.status(400).json({ success: false, message: `Topic name "${name}" already exists in the chapter` });
    }

    const oldName = topic.name;
    topic.name = name;
    await topic.save();

    // Update the name in Ques and Subtopic collections
    await Ques.updateMany(
      { topics: oldName },
      { $set: { "topics.$": name } }
    );

    await Subtopic.updateMany(
      { topicName: oldName },
      { $set: { topicName: name } }
    );

    return res.status(200).json({ success: true, message: 'Topic name updated successfully across all related collections' });
  } catch (error) {
    console.error('Error in updateTopic:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};


export const deleteTopicnullquestion = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Topic ID must be provided' });
    }

    const topic = await Topic.findById(id);

    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    const associatedQuestions = await Ques.find({ topics: topic.name });

    if (associatedQuestions.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Topic "${topic.name}" cannot be deleted because it is associated with ${associatedQuestions.length} question(s).`,
      });
    }

    await Topic.findByIdAndDelete(id);

    await Chapter.updateMany({ topics: id }, { $pull: { topics: id } });

    await Subtopic.deleteMany({ _id: { $in: topic.subtopics } });

    return res.status(200).json({ 
      success: true, 
      message: 'Topic and its associated subtopics deleted successfully' 
    });
  } catch (error) {
    console.error('Error in deleteTopicnullquestion:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};


