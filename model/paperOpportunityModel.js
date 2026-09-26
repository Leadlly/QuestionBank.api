import mongoose from "mongoose";

const paperOpportunitySchema = new mongoose.Schema(
  {
    exam: { type: String, required: true },
    year: { type: Number, required: true },
    session: { type: String, default: "" },
    shift: { type: String, default: "" },
    paperCode: { type: String, default: "" },
    questionCount: { type: Number, default: null },
    syllabusVersion: { type: String, default: "" },
  },
  { collection: "paper_opportunities", timestamps: true }
);

paperOpportunitySchema.index(
  { exam: 1, year: 1, session: 1, shift: 1, paperCode: 1 },
  { unique: true }
);

export const PaperOpportunity = mongoose.model(
  "PaperOpportunity",
  paperOpportunitySchema
);
