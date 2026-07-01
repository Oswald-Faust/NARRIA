/**
 * Extraction narratologique via Claude — port de `narria/llm/claude_client.py`
 * (analyze_narrative) avec chunking (`narria/llm/chunker.py`) pour les textes longs.
 */
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SYSTEM_PROMPT_NARRATOLOGY, buildUserPrompt, type PromptMeta } from "./llm-prompts";
import { LlmAnalysisSchema, enforceCulturalRestriction, type LlmAnalysis, type LlmNode } from "./llm-schema";
import { needsChunking, chunkText, mergePartialGraphs, type TextChunk } from "./chunker";
import type { NarrativeGraph, NarrativeNode, LlmAnalysisMetadata } from "../models";

export const EXTRACTION_MODEL_ID = "claude-sonnet-4-6";
const PRICE_INPUT_PER_MTOK = 3.0;
const PRICE_OUTPUT_PER_MTOK = 15.0;

export interface LlmExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

function costFromUsage(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_INPUT_PER_MTOK + outputTokens * PRICE_OUTPUT_PER_MTOK) / 1_000_000;
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
    usage: { inputTokens, outputTokens, costUsd: costFromUsage(inputTokens, outputTokens) },
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
    for (const chunk of chunks) {
      const { analysis, usage } = await analyzeChunk(chunk.text, promptMeta);
      partials.push(analysis);
      totalUsage = {
        inputTokens: totalUsage.inputTokens + usage.inputTokens,
        outputTokens: totalUsage.outputTokens + usage.outputTokens,
        costUsd: totalUsage.costUsd + usage.costUsd,
      };
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
    },
    nodes,
    edges: [],
  };

  return { graph, usage: totalUsage };
}
