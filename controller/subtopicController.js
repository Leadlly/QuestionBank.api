import { Ques } from '../model/quesModel.js';
import { Subject } from '../model/subjectModel.js';
import { Subtopic } from '../model/subtopicModel.js';
import { Topic } from '../model/topicModel.js';


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

        if (!subjectName || !standard || !chapterName || !topicName) {
            return res.status(400).json({
                success: false,
                message: "Missing required query parameters (subjectName, standard, chapterName, topicName)."
            });
        }

        const chapterNameArray = chapterName.split(',').map(name => name.trim());
        const topicNameArray = topicName.split(',').map(name => name.trim());

        // Fetch the subject and populate chapters, topics, and subtopics
        const subject = await Subject.findOne({
            name: subjectName,
            standard,
        }).populate({
            path: 'chapters',
            match: { name: { $in: chapterNameArray } },
            populate: {
                path: 'topics',
                match: { name: { $in: topicNameArray } },
                populate: {
                    path: 'subtopics',  // Ensure this path includes subtopic names
                    select: 'name',     // Select fields you need
                }
            }
        });

        if (!subject) {
            return res.status(404).json({ success: false, message: "Subject not found" });
        }

        let subtopics = [];

        // Flatten and collect all subtopics from the populated data
        subject.chapters.forEach(chapter => {
            chapter.topics.forEach(topic => {
                subtopics.push(...topic.subtopics);
            });
        });

        // Map subtopics with their names
        subtopics = subtopics.map(subtopic => ({
            _id: subtopic._id,
            name: subtopic.name, // Use the name directly
        }));

        res.status(200).json({
            success: true,
            subtopics,
        });
    } catch (error) {
        console.error('Error in getSubtopics:', error);
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



export const updateSubtopic = async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
  
      if (!id || !name) {
        return res.status(400).json({ success: false, message: 'Subtopic ID and new name must be provided' });
      }
  
      const subtopic = await Subtopic.findById(id);
  
      if (!subtopic) {
        return res.status(404).json({ success: false, message: 'Subtopic not found' });
      }
  
      const oldName = subtopic.name;
      subtopic.name = name; 
      await subtopic.save();
  
      await Ques.updateMany(
        { subtopics: oldName },
        { $set: { "subtopics.$[elem]": name } },
        { arrayFilters: [{ "elem": oldName }] }
      );
      await Topic.updateMany(
        { subtopics: id },
        { $set: { "subtopics.$[elem]": id } },
        { arrayFilters: [{ "elem": id }] }
      );
      return res.status(200).json({ success: true, message: 'Subtopic name updated successfully in Subtopic and Ques collections' });
    } catch (error) {
      console.error('Error in updateSubtopic:', error);
      return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
    }
  };

  export const deleteSubtopic = async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!id) {
        return res.status(400).json({ success: false, message: 'Subtopic ID must be provided' });
      }
  
      const subtopic = await Subtopic.findById(id);
  
      if (!subtopic) {
        return res.status(404).json({ success: false, message: 'Subtopic not found' });
      }
  
      const associatedQuestions = await Ques.find({ subtopics: subtopic.name });

    if (associatedQuestions.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Subtopic "${subtopic.name}" cannot be deleted because it is associated with ${associatedQuestions.length} question(s).`,
      });
    }
  
      await Subtopic.findByIdAndDelete(id);
  
      await Topic.updateMany(
        { subtopics: id }, 
        { $pull: { subtopics: id } }
      );

      await Ques.updateMany(
        { subtopics: subtopic.name }, 
        { $pull: { subtopics: subtopic.name } }
      );
  
      return res.status(200).json({ 
        success: true, 
        message: 'Subtopic deleted successfully and removed from all related topics' 
      });
    } catch (error) {
      console.error('Error in deleteSubtopicnullquestion:', error);
      return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
    }
  };
  
  
  
  