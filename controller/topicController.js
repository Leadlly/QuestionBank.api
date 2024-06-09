import { Topic } from "../model/topicModel.js";
import {Subject} from "../model/subjectModel.js";


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
    const { subjectName, standard, chapterNames } = req.query;

    if (!subjectName || !standard || !chapterNames) {
      return res.status(400).json({ success: false, message: 'Subject name, standard, and chapter names must be provided' });
    }

    const chapterNameArray = chapterNames.split(',').map(name => name.trim());

    const existingSubject = await Subject.findOne({ name: subjectName, standard })
      .populate({
        path: 'chapters',
        match: { name: { $in: chapterNameArray } },
        populate: {
          path: 'topics',
          populate: {
            path: 'subtopics', // Populate subtopics for each topic
          },
        },
      });

    if (!existingSubject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    let topics = [];
    existingSubject.chapters.forEach(chapter => {
      if (chapter.topics && chapter.topics.length > 0) {
        topics = [...topics, ...chapter.topics];
      }
    });

    if (topics.length === 0) {
      return res.status(404).json({ success: false, message: 'No topics found for the specified chapters' });
    }

    return res.status(200).json({ success: true, topics });
  } catch (error) {
    console.error('Error in getTopic:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};





