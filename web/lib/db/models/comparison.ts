import { Schema, model, models } from "mongoose";

/** Comparaison de deux œuvres : scores SNS/SS/ST/SRJ + verdict. */
const ComparisonSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    refTitle: { type: String, default: "Œuvre de référence" },
    candTitle: { type: String, default: "Œuvre candidate" },
    mode: { type: String, enum: ["heuristic", "llm"], default: "llm" },
    scores: {
      sns: Number, snsNormalized: Number, ss: Number, st: Number, srj: Number,
      sIso: Number, sGed: Number, sFunc: Number, sAct: Number, sTens: Number,
    },
    snsNormalized: Number,
    srjLevel: String,
    modality: String,
    verdict: String,
    correspondences: { type: Schema.Types.Mixed, default: [] },
    warnings: { type: [String], default: [] },
    costUsd: Number,
    refGraph: { type: Schema.Types.Mixed },
    candGraph: { type: Schema.Types.Mixed },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
  },
  { timestamps: true },
);

export const Comparison = models.Comparison || model("Comparison", ComparisonSchema);
