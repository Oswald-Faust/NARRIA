/**
 * Point d'entrée du moteur narratologique NARR'IA (port TypeScript).
 * Pipeline heuristique : segmentation (M1) → extraction (M2) → comparaison (M3).
 */
import { segment } from "./segmentation/segmenter";
import { extractGraph } from "./extraction/heuristic-extractor";
import type { NarrativeGraph } from "./models";

export * from "./models";
export { compare } from "./comparison/comparator";
export { FUNCTION_REPERTOIRE, getFunctionByCode, allFunctionCodes, totalFunctions } from "./repertoire";
export { segment } from "./segmentation/segmenter";
export { extractGraph } from "./extraction/heuristic-extractor";

export interface AnalysisMeta {
  title?: string;
  author?: string;
}

/** Analyse heuristique complète d'un texte → graphe narratif (NarRep-Graph). */
export function analyzeHeuristic(text: string, meta: AnalysisMeta = {}): NarrativeGraph {
  const segments = segment(text);
  return extractGraph(segments, {
    title: meta.title ?? "Texte sans titre",
    author: meta.author ?? "Auteur inconnu",
  });
}
