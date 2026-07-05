/**
 * Extraction narratologique via Claude — port de `narria/llm/claude_client.py`
 * (analyze_narrative) avec chunking (`narria/llm/chunker.py`) pour les textes longs.
 */
import { streamObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SYSTEM_PROMPT_NARRATOLOGY, buildUserPrompt, type PromptMeta } from "./llm-prompts";
import { LlmAnalysisSchema, enforceCulturalRestriction, type LlmAnalysis, type LlmNode } from "./llm-schema";
import { needsChunking, chunkText, mergePartialGraphs, type TextChunk } from "./chunker";
import type { NarrativeGraph, NarrativeNode, NarrativeEdge, LlmAnalysisMetadata } from "../models";
import { estimateCostUsd } from "@/lib/pricing";

export const EXTRACTION_MODEL_ID = "claude-sonnet-4-6";

export interface LlmExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Erreur d'extraction LLM portant l'usage (tokens/coût) déjà consommé avant l'échec. */
export class LlmExtractionError extends Error {
  constructor(
    message: string,
    public readonly partialUsage: LlmExtractionUsage,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmExtractionError";
  }
}

/** Estime le nombre de nœuds attendus (~1/400 mots, plancher 5, plafond 35) — reflète la
 *  consigne de granularité du prompt, utilisé uniquement pour estimer une progression. */
export function estimateTargetNodeCount(wordCount: number): number {
  const raw = Math.round(wordCount / 400);
  return Math.min(35, Math.max(5, raw));
}

async function analyzeChunk(
  text: string,
  meta: PromptMeta,
  onProgress?: (chunkFraction: number) => void,
): Promise<{ analysis: LlmAnalysis; usage: LlmExtractionUsage }> {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const targetNodes = estimateTargetNodeCount(wordCount);

  const result = streamObject({
    model: anthropic(EXTRACTION_MODEL_ID),
    system: SYSTEM_PROMPT_NARRATOLOGY,
    prompt: buildUserPrompt(text, meta),
    schema: LlmAnalysisSchema,
    maxRetries: 2,
  });

  if (onProgress) {
    (async () => {
      try {
        for await (const partial of result.partialObjectStream) {
          // Les nœuds occupent le gros du volume généré, mais plusieurs champs sont
          // streamés APRÈS eux (main_actants_v1/v2, thematic_keywords) : sans en tenir
          // compte, la progression restait bloquée à son plafond pendant toute cette
          // phase finale, donnant une fausse impression de blocage.
          const nodesSoFar = Array.isArray(partial?.nodes) ? partial.nodes.length : 0;
          const nodesFraction = Math.min(1, nodesSoFar / targetNodes);
          const hasActantsV1 = Boolean(partial?.main_actants_v1?.protagoniste);
          const hasActantsV2 = Boolean(partial?.main_actants_v2?.protagoniste);
          const hasKeywords = Array.isArray(partial?.thematic_keywords) && partial.thematic_keywords.length > 0;
          const tailFraction = (Number(hasActantsV1) + Number(hasActantsV2) + Number(hasKeywords)) / 3;
          onProgress(Math.min(0.98, nodesFraction * 0.85 + tailFraction * 0.15));
        }
      } catch {
        // Le flux de progression est best-effort ; toute erreur réelle remonte via result.object.
      }
    })();
  }

  const object = await result.object;
  const usage = await result.usage;
  onProgress?.(1);

  const analysis = enforceCulturalRestriction(object);
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;

  return {
    analysis,
    usage: { inputTokens, outputTokens, costUsd: estimateCostUsd(EXTRACTION_MODEL_ID, { inputTokens, outputTokens }) },
  };
}

function nodeIdFor(index: number): string {
  return `n${String(index + 1).padStart(3, "0")}`;
}

function toNarrativeNode(node: LlmNode, index: number): NarrativeNode {
  return {
    nodeId: nodeIdFor(index),
    segmentId: `seg_${nodeIdFor(index)}`,
    functionCode: node.function_code || null,
    functionFamily: node.function_family || null,
    functionName: node.function_name || null,
    actants: node.actants,
    modalities: node.modalities,
    tension: node.tension,
    phase: node.phase || null,
    textExcerpt: node.text_excerpt,
  };
}

/**
 * Construit des arêtes séquentielles reliant chaque nœud consécutif (n nœuds → n-1 arêtes).
 * Fidélité au rendu Python (« N nœuds, M transitions ») ; `comparator.ts` n'utilise pas
 * les arêtes, donc aucun impact sur les scores.
 */
export function buildSequentialEdges(nodes: NarrativeNode[]): NarrativeEdge[] {
  const edges: NarrativeEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      edgeId: `e_${String(i).padStart(3, "0")}`,
      source: nodes[i].nodeId,
      target: nodes[i + 1].nodeId,
      transitionType: "sequential",
      weight: 1,
    });
  }
  return edges;
}

export interface LlmAnalysisMeta {
  title?: string;
  author?: string;
}

export interface LlmAnalysisOutcome {
  graph: NarrativeGraph;
  usage: LlmExtractionUsage;
}

export interface LlmProgressEvent {
  stage: "extracting" | "merging" | "done";
  /** Progression globale [0, 1] sur l'ensemble du texte (tous chunks confondus). */
  fraction: number;
  /** Bloc courant (1-indexé) et nombre total de blocs, pour affichage ("bloc 2/3"). */
  chunkIndex?: number;
  chunkTotal?: number;
}
export type LlmProgressCallback = (event: LlmProgressEvent) => void;

/** Analyse LLM complète d'un texte → graphe narratif enrichi (mode par défaut de /api/analyze). */
export async function analyzeLLM(
  text: string,
  meta: LlmAnalysisMeta = {},
  onProgress?: LlmProgressCallback,
): Promise<LlmAnalysisOutcome> {
  const promptMeta: PromptMeta = { title: meta.title, author: meta.author };

  let merged: LlmAnalysis;
  let totalUsage: LlmExtractionUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let mergeInfo: LlmAnalysisMetadata["mergeInfo"];

  if (!needsChunking(text)) {
    const { analysis, usage } = await analyzeChunk(text, promptMeta, (f) =>
      onProgress?.({ stage: "extracting", fraction: f }),
    );
    merged = analysis;
    totalUsage = usage;
  } else {
    const chunks: TextChunk[] = chunkText(text);
    const partials: LlmAnalysis[] = [];
    // Séquentiel : respecte le rate limit Anthropic et l'ordre attendu par mergePartialGraphs
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const { analysis, usage } = await analyzeChunk(chunk.text, promptMeta, (chunkFraction) => {
          const globalFraction = (i + chunkFraction) / chunks.length;
          onProgress?.({
            stage: "extracting",
            fraction: globalFraction,
            chunkIndex: i + 1,
            chunkTotal: chunks.length,
          });
        });
        partials.push(analysis);
        totalUsage = {
          inputTokens: totalUsage.inputTokens + usage.inputTokens,
          outputTokens: totalUsage.outputTokens + usage.outputTokens,
          costUsd: totalUsage.costUsd + usage.costUsd,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new LlmExtractionError(
          `Échec de l'extraction LLM après ${partials.length}/${chunks.length} chunk(s) traité(s) : ${message}`,
          totalUsage,
          err,
        );
      }
    }
    onProgress?.({ stage: "merging", fraction: 0.98 });
    const mergedResult = mergePartialGraphs(partials, chunks);
    merged = mergedResult.analysis;
    mergeInfo = mergedResult.mergeInfo;
  }

  const nodes = merged.nodes.map(toNarrativeNode);

  const metadata: LlmAnalysisMetadata = {
    mode: "llm",
    summary: merged.summary,
    genre: merged.genre,
    tradition: merged.tradition,
    formalFeatures: merged.formal_features,
    mainActants: { v1: merged.main_actants_v1, v2: merged.main_actants_v2 },
    thematicKeywords: merged.thematic_keywords,
    costUsd: totalUsage.costUsd,
    tokensTotal: totalUsage.inputTokens + totalUsage.outputTokens,
    mergeInfo,
  };

  const graph: NarrativeGraph = {
    graphId: `g_llm_${Date.now().toString(36)}`,
    metadata: {
      title: meta.title ?? "Texte sans titre",
      author: meta.author ?? "Auteur inconnu",
      ...metadata,
      // Clés à plat consommées par comparator.ts (scoreGreimasAlignment / deltaFocus)
      main_actants_v1: merged.main_actants_v1,
      main_actants_v2: merged.main_actants_v2,
    },
    nodes,
    edges: buildSequentialEdges(nodes),
  };

  onProgress?.({ stage: "done", fraction: 1 });

  return { graph, usage: totalUsage };
}
