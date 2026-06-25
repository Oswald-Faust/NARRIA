import { Schema, model, models } from "mongoose";

/** Analyse d'un texte : graphe narratif (NarRep-Graph) + métadonnées. */
const AnalysisSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, default: "Texte sans titre" },
    author: { type: String, default: "Auteur inconnu" },
    mode: { type: String, enum: ["heuristic", "llm"], default: "heuristic" },
    wordCount: { type: Number, default: 0 },
    nNodes: { type: Number, default: 0 },
    graph: { type: Schema.Types.Mixed, required: true },
    costTokens: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Analysis = models.Analysis || model("Analysis", AnalysisSchema);
