import mongoose from "mongoose";

const pyqRecordSchema = new mongoose.Schema(
  {
    exam: { type: String, required: true },
    year: { type: Number, required: true },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    session: { type: String, default: "" },
    shift: { type: String, default: "" },
    subject: { type: String, default: "" },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", default: null },
    subtopicId: { type: mongoose.Schema.Types.ObjectId, ref: "Subtopic", default: null },
    chapterName: { type: String, default: "" },
    topicName: { type: String, default: "" },
    questionCount: { type: Number, default: 1 },
    marks: { type: Number, default: null },
    source: { type: String, default: "" },
  },
  { collection: "pyq_records", timestamps: true }
);

export const PyqRecord = mongoose.model("PyqRecord", pyqRecordSchema);
