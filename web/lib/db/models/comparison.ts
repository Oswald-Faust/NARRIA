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
    // Correctifs P1-6 / P1-7 / P2-8 de la note interne du 27/07/2026 : couverture
    // d'appariement, confrontation des genres et décision d'alerte explicitée.
    coverage: { type: Schema.Types.Mixed, default: null },
    /** Confinement d'une œuvre dans l'autre (extrait, version tronquée). */
    inclusion: { type: Schema.Types.Mixed, default: null },
    genre: { type: Schema.Types.Mixed, default: null },
    normalizationApplied: { type: Boolean, default: null },
    baseline: { type: Schema.Types.Mixed, default: null },
    alert: { type: Schema.Types.Mixed, default: null },
    costUsd: Number,
    refGraph: { type: Schema.Types.Mixed },
    candGraph: { type: Schema.Types.Mixed },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
  },
  { timestamps: true },
);

export const Comparison = models.Comparison || model("Comparison", ComparisonSchema);
