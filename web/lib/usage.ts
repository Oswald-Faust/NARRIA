import { connectDB } from "@/lib/db/mongoose";
import { ApiUsage, type UsageRoute } from "@/lib/db/models/api-usage";
import { estimateCostUsd } from "@/lib/pricing";

interface RecordUsageInput {
  ownerId: string;
  route: UsageRoute;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  success?: boolean;
  error?: string;
}

/**
 * Enregistre une requête API (tokens + coût estimé). Tolérant aux erreurs :
 * un échec d'écriture ne doit jamais casser la requête métier.
 */
export async function recordUsage(input: RecordUsageInput) {
  try {
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;
    const cachedInputTokens = input.cachedInputTokens ?? 0;
    const model = input.model ?? "";
    const costUsd = model
      ? estimateCostUsd(model, { inputTokens, outputTokens, cachedInputTokens })
      : 0;

    await connectDB();
    return await ApiUsage.create({
      ownerId: input.ownerId,
      route: input.route,
      model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      success: input.success ?? true,
      error: input.error ?? "",
    });
  } catch (err) {
    console.error("[usage] enregistrement impossible:", err);
    return null;
  }
}
