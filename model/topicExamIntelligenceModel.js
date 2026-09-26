import mongoose from "mongoose";

const topicExamIntelligenceSchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", default: null },
    topicName: { type: String, default: "" },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    chapterName: { type: String, default: "" },
    subject: { type: String, default: "" },
    exam: { type: String, required: true },
    syllabusStatus: {
      type: String,
      enum: ["active", "not_applicable", "untracked"],
      default: "untracked",
    },
    totalRelevantPapers: { type: Number, default: null },
    pyqCount: { type: Number, default: null },
    frequencyRate: { type: Number, default: null },
    recencyScore: { type: Number, default: null },
    examImportance: { type: Number, default: null },
    importanceConfidence: { type: Number, default: null },
    provisional: { type: Boolean, default: true },
    inherited: { type: Boolean, default: false },
    dataStartYear: { type: Number, default: null },
    dataEndYear: { type: Number, default: null },
    source: { type: String, default: "" },
    lastCalculatedAt: { type: Date, default: null },
  },
  { collection: "topic_exam_intelligence", timestamps: true }
);

topicExamIntelligenceSchema.index(
  { topicId: 1, exam: 1 },
  { unique: true, partialFilterExpression: { topicId: { $type: "objectId" } } }
);

export const TopicExamIntelligence = mongoose.model(
  "TopicExamIntelligence",
  topicExamIntelligenceSchema
);
