import { Subject } from "../model/subjectModel.js";

export const createSubject = async (req, res) => {
    try {
        const { subjectName, standard, chapters } = req.body;

        if (!subjectName || !standard) {
            return res.status(400).json({ success: false, message: 'Subject name and standard are required.' });
        }

        const chaptersArray = Array.isArray(chapters) ? chapters : [];

        const existingSubject = await Subject.findOne({ name: subjectName, standard });
        if (existingSubject) {
            return res.status(400).json({ success: false, message: 'Subject already exists.' });
        }

        const newSubject = await Subject.create({
            name: subjectName,
            standard,
            chapters: chaptersArray,
        });

        res.status(201).json({
            success: true,
            message: 'Subject created successfully.',
            subject: newSubject,
        });
    } catch (error) {
        console.error('Error creating subject:', error);
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



