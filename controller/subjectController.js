import { Subject } from "../model/subjectModel.js";

export const createSubject = async(req, res) =>{
    
  try {
    const {subject} = req.body

    const existingSubject = await Subject.findOne({ "subject.name": subject.name });
    if (existingSubject) {
      return res.status(400).json({ success: false, message: "Subject already exists" });
    }

   const sub = await Subject.create({
        subject
    })

    res.status(201).json({
        success: true,
        message: "Subject Created",
        sub
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({success: false, message: error.message || "Internal Server Error"})
  }
}

export const createChapter = async (req, res) => {
    try {
      const { subject } = req.body;
      const existingSubject = await Subject.findOne({ "subject.name": subject.name });
      if (!existingSubject) {
        return res.status(404).json({ success: false, message: "Subject not found" });
      }
      existingSubject.subject.chapters.push(...subject.chapters);
      await existingSubject.save();
      res.status(201).json({ success: true, message: "Chapter and topics added to subject" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
  };
  
  export const createTopic = async (req, res) => {
    try {
      const { subjectName, chapterName, topics } = req.body;
      const existingSubject = await Subject.findOne({ "subject.name": subjectName });
      if (!existingSubject) {
        return res.status(404).json({ success: false, message: "Subject not found" });
      }
  
      const existingChapter = existingSubject.subject.chapters.find(chapter => chapter.name === chapterName);
      if (!existingChapter) {
        return res.status(404).json({ success: false, message: "Chapter not found" });
      }
  
      existingChapter.topics.push(...topics);
      await existingSubject.save();
  
      res.status(201).json({ success: true, message: "Topic added to chapter" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
  };
  

export const getAllSubject = async(req, res) => {
    try {
        const subjects = await Subject.find()
        res.status(200).json({
            success: true,
            subjects
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
      }
}
export const getChapter = async(req, res) => {
    try {
        const subject = await Subject.findOne({"subject.name": req.query.subjectName})

        const chapters = subject.subject.chapters?.map(chapter => chapter?.name)

        res.status(200).json({
            success: true,
            chapters
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
      }
}

export const getTopic = async(req, res) => {
    try {
        const subjects = await Subject.findOne({"subject.name": req.query.subjectName})

        const chapter = subjects.subject.chapters.find(chapter => chapter.name === req.query.chapterName);
        if (!chapter) {
          return res.status(404).json({ success: false, message: "Chapter not found" });
        }

        const topics = chapter.topics?.map(topic => topic)

        res.status(200).json({
            success: true,
            topics
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
      }
}