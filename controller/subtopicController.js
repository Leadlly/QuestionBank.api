import { Subject } from '../model/subjectModel.js'; 
import { Subtopic } from '../model/subtopicModel.js';


export const createSubtopic = async (req, res) => {
    try {
         const { subjectName, standard, chapterName, topicName, subtopics } = req.body;

         if (!subjectName || !standard || !chapterName || !topicName || !subtopics || !subtopics[0].name) {
            return res.status(400).json({ success: false, message: 'All input fields must be provided, including a valid subtopic name.' });
        }

       const existingSubject = await Subject.findOne({ name: subjectName, standard })
            .populate({
                path: 'chapters',
                match: { name: chapterName },
                populate: {
                    path: 'topics',
                    match: { name: topicName }
                }
            });

         if (!existingSubject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }

        const existingChapter = existingSubject.chapters.find(chapter => chapter.name === chapterName);
        if (!existingChapter) {
            return res.status(404).json({ success: false, message: 'Chapter not found' });
        }

        const existingTopic = existingChapter.topics.find(topic => topic.name === topicName);
        if (!existingTopic) {
            return res.status(404).json({ success: false, message: 'Topic not found' });
        }

        const addSubtopics = async (parentSubtopic, subtopicData) => {
             const newSubtopic = new Subtopic({
                name: subtopicData.name,
                subtopics: []
            });

             await newSubtopic.save();

            parentSubtopic.subtopics.push(newSubtopic._id);

             await parentSubtopic.save();

            if (subtopicData.subtopics && subtopicData.subtopics.length > 0) {
                for (const nestedSubtopicData of subtopicData.subtopics) {
                    await addSubtopics(newSubtopic, nestedSubtopicData);
                }
            }
        };

         for (const subtopicData of subtopics) {
            await addSubtopics(existingTopic, subtopicData);
        }

        return res.status(201).json({ success: true, message: 'Subtopic(s) created and added to topic successfully' });
    } catch (error) {
        console.error('Error in createSubtopic:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
};



export const getSubtopics = async (req, res) => {
    try {
         const { subjectName, standard, chapterName, topicName } = req.query;

        if (!subjectName || !standard || !chapterName || !topicName) {
            return res.status(400).json({
                success: false,
                message: "Missing required query parameters (subjectName, standard, chapterName, topicName)."
            });
        }

        const subject = await Subject.findOne({
            name: subjectName,
            standard: standard,
        }).populate({
            path: 'chapters',
            match: { name: chapterName },
            populate: {
                path: 'topics',
                match: { name: topicName },
                populate: 'subtopics'
            }
        });

         if (!subject) {
            return res.status(404).json({ success: false, message: "Subject not found" });
        }

         const chapter = subject.chapters.find(ch => ch.name === chapterName);
        if (!chapter) {
            return res.status(404).json({ success: false, message: "Chapter not found" });
        }

        const topic = chapter.topics.find(t => t.name === topicName);
        if (!topic) {
            return res.status(404).json({ success: false, message: "Topic not found" });
        }

        const subtopics = topic.subtopics;

        res.status(200).json({
            success: true,
            subtopics,
        });
    } catch (error) {
        console.error('Error in getSubTopic:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
};

