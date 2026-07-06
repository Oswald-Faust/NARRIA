import { Schema, model, models } from "mongoose";

/**
 * Trace d'une requête vers l'API Claude (ou le moteur heuristique) — sert au
 * dashboard admin : volume de requêtes, tokens consommés, coût estimé.
 */
export const USAGE_ROUTES = ["chat", "analyze", "compare", "synthesis"] as const;
export type UsageRoute = (typeof USAGE_ROUTES)[number];

const ApiUsageSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    route: { type: String, enum: USAGE_ROUTES, required: true, index: true },
    model: { type: String, default: "" },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cachedInputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    error: { type: String, default: "" },
  },
  { timestamps: true },
);

ApiUsageSchema.index({ createdAt: -1 });
ApiUsageSchema.index({ ownerId: 1, createdAt: -1 });

export const ApiUsage = models.ApiUsage || model("ApiUsage", ApiUsageSchema);
