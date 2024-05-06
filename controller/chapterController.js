import { Chapter } from "../model/chapterModel.js";
import {Subject} from "../model/subjectModel.js"
import {Topic} from "../model/topicModel.js"



export const createChapter = async (req, res) => {
    try {
        const { subject } = req.body;
        const { name, chapters } = subject || {};

        if (!name || !Array.isArray(chapters)) {
            return res.status(400).json({ success: false, message: 'Subject name and chapters (array) must be provided.' });
        }

        const existingSubject = await Subject.findOne({ name }).populate('chapters'); // Ensure to populate the chapters

        if (existingSubject) {
            for (const chapterData of chapters) {
                const { name: chapterName, topics } = chapterData;

                const existingChapter = existingSubject.chapters.find(
                    chapter => chapter.name === chapterName
                );

                if (existingChapter) {
                    return res.status(400).json({ success: false, message: `Chapter "${chapterName}" already exists.` });
                }

                const newChapter = new Chapter({ name: chapterName });

                if (Array.isArray(topics)) {
                    for (const topicName of topics) {
                        const newTopic = new Topic({ name: topicName });
                        await newTopic.save();
                        newChapter.topics.push(newTopic._id);
                    }
                }

                await newChapter.save();
                existingSubject.chapters.push(newChapter._id);
            }

            await existingSubject.save();

            return res.status(200).json({ success: true, message: 'Chapters added successfully.', chapters });
        } else {
            return res.status(404).json({ success: false, message: 'Subject not found.' });
        }
    } catch (error) {
            console.error('Error creating chapter:', error);
            console.log('Full error object:', error);
            console.log('Error response data:', error.response?.data);
            console.log('Error response:', error.response);
            console.log('Error message:', error.message);
        
        
    
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
};









export const getChapter = async (req, res) => {
    try {

        const subjectName = (req.query.subjectName || req.body.subjectName || '').trim();
        const standard = (req.query.standard || req.body.standard || '').trim();

        if (!subjectName || !standard) {
            return res.status(400).json({
                success: false,
                message: 'subjectName and standard are required',
            });
        }

        const subject = await Subject.findOne({
            name: { $regex: new RegExp(`^${subjectName}$`, 'i') },
            standard: { $regex: new RegExp(`^${standard}$`, 'i') },
        });
        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found',
            });
        }

        if (!subject.chapters || subject.chapters.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No chapters found for the subject',
            });
        }
        const chapters = await Chapter.find({ _id: { $in: subject.chapters } })
            .populate('topics');

        return res.status(200).json({
            success: true,
            chapters: chapters.map(chapter => ({
                _id: chapter._id,
                name: chapter.name,
                topics: chapter.topics,
            })),
        });
    } catch (error) {
        console.error('Error in getChapter:', error);

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Internal Server Error',
            });
        }
    }
};


