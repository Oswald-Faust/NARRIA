import { Schema, model, models } from "mongoose";

/** Analyse d'un texte : graphe narratif (NarRep-Graph) + métadonnées. */
const AnalysisSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, default: "Texte sans titre" },
    author: { type: String, default: "Auteur inconnu" },
    mode: { type: String, enum: ["heuristic", "llm"], default: "llm" },
    wordCount: { type: Number, default: 0 },
    nNodes: { type: Number, default: 0 },
    graph: { type: Schema.Types.Mixed, required: true },
    costTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    summary: { type: String, default: "" },
    genre: { type: String, default: "" },
    tradition: { type: String, default: "" },
    mainActants: { type: Schema.Types.Mixed, default: null },
    thematicKeywords: { type: [String], default: [] },
    formalFeatures: { type: Schema.Types.Mixed, default: null },
    sourceFile: {
      type: new Schema(
        { filename: String, format: String, warnings: [String] },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

export const Analysis = models.Analysis || model("Analysis", AnalysisSchema);
