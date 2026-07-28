/**
 * Cache d'extraction — couche applicative entre les routes et le moteur.
 *
 * Un texte déjà analysé (même contenu, même modèle, même version de moteur)
 * réutilise son graphe au lieu d'être ré-extrait. Deux effets, tous deux
 * demandés par les bêta-testeurs :
 *
 *  - STABILITÉ : comparer une œuvre à elle-même cesse de produire des nœuds
 *    orphelins nés de la seule variance du modèle de langage. Deux textes
 *    identiques donnent désormais, par construction, deux graphes identiques.
 *  - COÛT : l'analyse n'est plus refacturée à chaque soumission du même texte.
 *
 * Le cache est cloisonné par propriétaire : il n'expose jamais le graphe d'une
 * œuvre d'un autre utilisateur.
 */
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { analyzeLLM, type NarrativeGraph } from "@/lib/engine";
import type { LlmAnalysisMeta, LlmExtractionUsage, LlmProgressCallback } from "@/lib/engine/extraction/llm-extractor";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";
import { extractionKey } from "@/lib/engine/extraction/extraction-key";

export interface CachedAnalysisOutcome {
  graph: NarrativeGraph;
  usage: LlmExtractionUsage;
  /** Empreinte du texte — à persister sur l'analyse créée, pour alimenter le cache. */
  key: string;
  /** Vrai si le graphe provient du cache (aucun appel au modèle, coût nul). */
  fromCache: boolean;
}

const NO_USAGE: LlmExtractionUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

/**
 * Analyse un texte en réutilisant le graphe déjà extrait s'il existe.
 * Signale la réutilisation via `onProgress` pour que l'interface ne laisse pas
 * croire à une analyse instantanée inexpliquée.
 */
export async function analyzeWithCache(
  text: string,
  meta: LlmAnalysisMeta,
  ownerId: string,
  onProgress?: LlmProgressCallback,
): Promise<CachedAnalysisOutcome> {
  const key = extractionKey(text, { mode: "llm", model: EXTRACTION_MODEL_ID });

  await connectDB();
  const cached = await Analysis.findOne({ ownerId, extractionKey: key })
    .sort({ createdAt: -1 })
    .lean<{ graph: NarrativeGraph } | null>();

  if (cached?.graph?.nodes?.length) {
    onProgress?.({ stage: "done", fraction: 1 });
    return { graph: cached.graph, usage: NO_USAGE, key, fromCache: true };
  }

  const { graph, usage } = await analyzeLLM(text, meta, onProgress);
  return { graph, usage, key, fromCache: false };
}
