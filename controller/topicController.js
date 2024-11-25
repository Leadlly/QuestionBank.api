import { Topic } from "../model/topicModel.js";
import { Subject } from "../model/subjectModel.js";
import { Chapter } from "../model/chapterModel.js";
import {Ques} from "../model/quesModel.js";
import {Subtopic} from "../model/subtopicModel.js"


export const createTopic = async (req, res) => {
  try {
    const { subjectName, standard, chapterName, topics } = req.body;

    if (!subjectName || !chapterName || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject name, chapter name, and topics (array) must be provided' 
      });
    }

    const existingSubject = await Subject.findOne({ name: subjectName, standard })
      .populate('chapters');

    if (!existingSubject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const existingChapter = existingSubject.chapters.find(chapter => chapter.name === chapterName);

    if (!existingChapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const chapterId = existingChapter._id; 

    const existingTopics = await Topic.find({
      chapterId,      
      subjectName,    
      standard        
    }, 'topicNumber');

    const existingTopicNumbers = new Set(existingTopics.map(topic => topic.topicNumber));

    const newTopics = [];
    for (const topic of topics) {
      if (!topic.name || typeof topic.name !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid topic name' });
      }

      const topicName = topic.name.trim();

      const topicNumber = topic.topicNumber || Math.max(0, ...Array.from(existingTopicNumbers)) + 1;
      if (existingTopicNumbers.has(topicNumber)) {
        return res.status(400).json({ success: false, message: `Topic number "${topicNumber}" already exists in the chapter "${chapterName}" for subject "${subjectName}" and standard "${standard}".` });
      }

      const newTopic = new Topic({ 
        name: topicName, 
        chapterName, 
        subjectName, 
        standard, 
        chapterId, 
        topicNumber: topicNumber 
      });

      await newTopic.save();

      existingTopicNumbers.add(topicNumber);
      newTopics.push(newTopic);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Topics created successfully', 
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
    if (chapterId) {
      const chapterIds = chapterId.includes(',') ? chapterId.split(',') : [chapterId];
      filter.chapterId = { $in: chapterIds };
    }

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
        path: 'subtopics',
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

export const getTopicByIds = async (req, res) => {
  try {
    const { topicIds } = req.body;

    const topics = []

    for ( let id of topicIds) {
      if (!id) {
        return res.status(400).json({ success: false, message: 'Topic ID must be provided' });
      }
  
      const topic = await Topic.findById(id)
        .populate({
          path: 'subtopics', 
        });
  
      if (!topic) {
        return res.status(404).json({ success: false, message: 'Topic not found' });
      }

      topics.push(topic)

    }

    return res.status(200).json({ success: true, topics });
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
    const { name, topicNumber } = req.body;

    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Topic ID and name must be provided' });
    }

    const topic = await Topic.findById(id);
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    const existingChapter = await Chapter.findOne({
      name: topic.chapterName,
      subjectName: topic.subjectName,
      standard: topic.standard,
    }).populate('topics');

    if (!existingChapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const existingTopics = await Topic.find(
      {
        chapterId: existingChapter._id,
        standard: topic.standard,
        subjectName: topic.subjectName,
      },
      'topicNumber'
    );

    const existingTopicNumbers = new Set(existingTopics.map(t => t.topicNumber));

    const newTopicNumber = topicNumber !== undefined ? topicNumber : topic.topicNumber;

    if (existingTopicNumbers.has(newTopicNumber) && newTopicNumber !== topic.topicNumber) {
      return res.status(400).json({
        success: false,
        message: `Topic number "${newTopicNumber}" already exists in the chapter "${topic.chapterName}" for subject "${topic.subjectName}" and standard "${topic.standard}".`,
      });
    }

    // Update topic details
    topic.name = name.trim();
    topic.topicNumber = newTopicNumber;
    await topic.save();

    res.status(200).json({ success: true, message: 'Topic updated successfully', topic });
  } catch (error) {
    console.error('Error in updateTopic:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
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


