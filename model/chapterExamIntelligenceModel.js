import mongoose from "mongoose";

const chapterExamIntelligenceSchema = new mongoose.Schema(
  {
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    chapterName: { type: String, required: true },
    subject: { type: String, required: true },
    standard: { type: Number, default: null },
    exam: { type: String, required: true },
    syllabusStatus: {
      type: String,
      enum: ["active", "not_applicable", "untracked"],
      default: "untracked",
    },
    metric: { type: String, default: null },
    rawValue: { type: Number, default: null },
    weightagePercent: { type: Number, default: null },
    totalRelevantPapers: { type: Number, default: null },
    pyqCount: { type: Number, default: null },
    frequencyRate: { type: Number, default: null },
    recencyScore: { type: Number, default: null },
    examImportance: { type: Number, default: null },
    importanceConfidence: { type: Number, default: null },
    provisional: { type: Boolean, default: true },
    inherited: { type: Boolean, default: false },
    grain: { type: String, default: "chapter" },
    formulaVersion: { type: String, default: "seed_frequency_only_v1" },
    dataStartYear: { type: Number, default: null },
    dataEndYear: { type: Number, default: null },
    source: { type: String, default: "" },
    notes: { type: String, default: "" },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { collection: "chapter_exam_intelligence", timestamps: true }
);

chapterExamIntelligenceSchema.index(
  { subject: 1, standard: 1, chapterName: 1, exam: 1 },
  { unique: true }
);

export const ChapterExamIntelligence = mongoose.model(
  "ChapterExamIntelligence",
  chapterExamIntelligenceSchema
);
