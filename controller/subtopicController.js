import { Subject } from '../model/subjectModel.js';
import { Subtopic } from '../model/subtopicModel.js';


export const createSubtopic = async (req, res) => {
    try {
        console.log("Received request body:", req.body);

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
                    match: { name: topicName },
                    populate: {
                        path: 'subtopics',
                    }
                }
            });

        if (!existingSubject) {
            console.log(`Subject not found: subjectName=${subjectName}, standard=${standard}`);
            return res.status(400).json({ success: false, message: 'Subject not found' });
        }

        const existingChapter = existingSubject.chapters.find(chapter => chapter.name === chapterName);
        if (!existingChapter) {
            console.log(`Chapter not found: chapterName=${chapterName}`);
            return res.status(400).json({ success: false, message: 'Chapter not found' });
        }

        const existingTopic = existingChapter.topics.find(topic => topic.name === topicName);
        if (!existingTopic) {
            console.log(`Topic not found: topicName=${topicName}`);
            return res.status(400).json({ success: false, message: 'Topic not found' });
        }

        const addSubtopicsRecursively = async (parentSubtopic, subtopicData) => {

            if (parentSubtopic.subtopics.some(sub => sub.name === subtopicData.name)) {
                throw new Error(`Subtopic "${subtopicData.name}" already exists`);
            }

            const newSubtopic = new Subtopic({
                name: subtopicData.name,
                topicName,
                chapterName,
                subjectName,
                standard,
                subtopics: [],
            });

            await newSubtopic.save();

            parentSubtopic.subtopics.push(newSubtopic._id);
            await parentSubtopic.save();

            if (subtopicData.subtopics && subtopicData.subtopics.length > 0) {
                for (const nestedSubtopic of subtopicData.subtopics) {
                    await addSubtopicsRecursively(newSubtopic, nestedSubtopic);
                }
            }
        };

        for (const subtopicData of subtopics) {
            await addSubtopicsRecursively(existingTopic, subtopicData);
        }

        res.status(201).json({
            success: true,
            message: 'Subtopic(s) created and added to topic successfully',
            subtopics,
        });
    } catch (error) {
        console.error('Error in createSubtopic:', error);

        if (error.message.includes('already exists')) {
            res.status(409).json({ success: false, message: error.message });
        } else {
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
};



export const getSubtopics = async (req, res) => {
    try {
        const { subjectName, standard, chapterName, topicName } = req.query;

        // Validate required query parameters
        if (!subjectName || !standard || !chapterName || !topicName) {
            return res.status(400).json({
                success: false,
                message: "Missing required query parameters (subjectName, standard, chapterName, topicName)."
            });
        }

        // Fetch subject data including chapters and topics
        const subject = await Subject.findOne({
            name: subjectName,
            standard,
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
            return res.status(400).json({ success: false, message: "Subject not found" });
        }

        const chapter = subject.chapters.find(ch => ch.name === chapterName);
        if (!chapter) {
            return res.status(400).json({ success: false, message: "Chapter not found" });
        }

        const topic = chapter.topics.find(t => t.name === topicName);
        if (!topic) {
            return res.status(400).json({ success: false, message: "Topic not found" });
        }

        // Get subtopics from the topic
        let subtopics = topic.subtopics;

        // Fetch full data for each nested subtopic
        for (let i = 0; i < subtopics.length; i++) {
            const subtopic = subtopics[i];

            // If there are nested subtopics, fetch their data
            if (subtopic.subtopics && subtopic.subtopics.length > 0) {
                const nestedSubtopicIds = subtopic.subtopics;
                // Fetch nested subtopic data
                const nestedSubtopics = await Subtopic.find({ _id: { $in: nestedSubtopicIds } });
                // Replace the subtopic IDs with their full data
                subtopics[i].subtopics = nestedSubtopics;
            }
        }

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



export const getNestedSubtopicsByName = async (req, res) => {
    try {
        const { subjectName, standard, chapterName, topicName, subtopicName } = req.query;

        if (!subjectName || !standard || !chapterName || !topicName || !subtopicName) {
            return res.status(400).json({
                success: false,
                message: 'All query parameters (subjectName, standard, chapterName, topicName, and subtopicName) must be provided.'
            });
        }

        const subtopic = await Subtopic.findOne({
            name: subtopicName,
            subjectName,
            standard,
            chapterName,
            topicName
        }).populate({
            path: 'subtopics',
        });

        if (!subtopic) {
            return res.status(404).json({ success: false, message: 'Subtopic not found' });
        }

        res.status(200).json({
            success: true,
            subtopic,
            nestedSubtopics: subtopic.subtopics,
        });
    } catch (error) {
        console.error('Error retrieving nested subtopics by name:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};




