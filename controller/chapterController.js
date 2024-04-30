import { Chapter } from "../model/chapterModel.js";
import {Subject} from "../model/subjectModel.js"
import {Topic} from "../model/topicModel.js"



export const createChapter = async (req, res) => {
    try {
        const { subjectName, standard, chapters } = req.body;

        if (!subjectName || !standard || !Array.isArray(chapters) || chapters.length === 0) {
            return res.status(400).json({ success: false, message: 'Subject name, standard, and chapters (array) must be provided' });
        }

        
        const existingSubject = await Subject.findOne({ name: subjectName, standard });

        if (!existingSubject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }

        const chapterIds = [];

        for (const chapterData of chapters) {
            const newChapter = new Chapter({
                name: chapterData.name,
                topics: [],
            });

            if (Array.isArray(chapterData.topics)) {
                for (const topicData of chapterData.topics) {
                    const newTopic = new Topic(topicData);

                    await newTopic.save();

                    newChapter.topics.push(newTopic._id);
                }
            }

            await newChapter.save();

            chapterIds.push(newChapter._id);
        }

        existingSubject.chapters.push(...chapterIds);

        await existingSubject.save();

        res.status(201).json({ success: true, message: 'Chapters added to subject successfully' });

    } catch (error) {
        console.error('Error creating chapters:', error);
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


