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
export {
  splitIntoBlocks,
  toJsonBlocks,
  renderBlocksForPrompt,
  blockAtChar,
  charRangeForBlocks,
} from "./segmentation/block-splitter";
export type { NarrativeBlock, SplitRule, BlockSplitOptions } from "./segmentation/block-splitter";
export { extractGraph } from "./extraction/heuristic-extractor";
export { alignSequences } from "./comparison/condensation";
export type { SequenceAlignment, AlignmentStep } from "./comparison/condensation";
export {
  measureStability,
  gradeStability,
  formatStabilityReport,
  STABILITY_TARGETS,
} from "./extraction/stability";
export type { StabilityReport, StabilityGrade } from "./extraction/stability";
export { analyzeLLM, LlmExtractionError } from "./extraction/llm-extractor";
export type {
  LlmAnalysisMeta,
  LlmAnalysisOutcome,
  LlmExtractionUsage,
  LlmProgressEvent,
  LlmProgressCallback,
} from "./extraction/llm-extractor";

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
