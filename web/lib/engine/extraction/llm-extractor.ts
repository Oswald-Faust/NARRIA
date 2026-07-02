/**
 * Extraction narratologique via Claude — port de `narria/llm/claude_client.py`
 * (analyze_narrative) avec chunking (`narria/llm/chunker.py`) pour les textes longs.
 */
import { generateObject } from "ai";
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

async function analyzeChunk(text: string, meta: PromptMeta): Promise<{ analysis: LlmAnalysis; usage: LlmExtractionUsage }> {
  const result = await generateObject({
    model: anthropic(EXTRACTION_MODEL_ID),
    system: SYSTEM_PROMPT_NARRATOLOGY,
    prompt: buildUserPrompt(text, meta),
    schema: LlmAnalysisSchema,
    maxRetries: 2,
  });

  const analysis = enforceCulturalRestriction(result.object);
  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;

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

/** Analyse LLM complète d'un texte → graphe narratif enrichi (mode par défaut de /api/analyze). */
export async function analyzeLLM(text: string, meta: LlmAnalysisMeta = {}): Promise<LlmAnalysisOutcome> {
  const promptMeta: PromptMeta = { title: meta.title, author: meta.author };

  let merged: LlmAnalysis;
  let totalUsage: LlmExtractionUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let mergeInfo: LlmAnalysisMetadata["mergeInfo"];

  if (!needsChunking(text)) {
    const { analysis, usage } = await analyzeChunk(text, promptMeta);
    merged = analysis;
    totalUsage = usage;
  } else {
    const chunks: TextChunk[] = chunkText(text);
    const partials: LlmAnalysis[] = [];
    // Séquentiel : respecte le rate limit Anthropic et l'ordre attendu par mergePartialGraphs
    for (const chunk of chunks) {
      try {
        const { analysis, usage } = await analyzeChunk(chunk.text, promptMeta);
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

  return { graph, usage: totalUsage };
}
