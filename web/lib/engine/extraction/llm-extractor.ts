/**
 * Extraction narratologique via Claude — port de `narria/llm/claude_client.py`
 * (analyze_narrative) avec chunking (`narria/llm/chunker.py`) pour les textes longs.
 */
import { streamObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SYSTEM_PROMPT_NARRATOLOGY, buildUserPrompt, type PromptMeta } from "./llm-prompts";
import {
  LlmAnalysisSchema,
  enforceCulturalRestriction,
  sanitizeAnalysisIdentity,
  type LlmAnalysis,
  type LlmNode,
} from "./llm-schema";
import { needsChunking, chunkText, mergePartialGraphs, type TextChunk } from "./chunker";
import { consensusMerge, configuredConsensusPasses, type ExtractionVariance } from "./consensus";
import { attachNodeEmbeddings } from "../comparison/embeddings";
import type { NarrativeGraph, NarrativeNode, NarrativeEdge, LlmAnalysisMetadata } from "../models";
import { estimateCostUsd } from "@/lib/pricing";

export const EXTRACTION_MODEL_ID = "claude-sonnet-4-6";

/** Température d'extraction — basse pour limiter la variance inter-exécutions (P2-9). */
export const EXTRACTION_TEMPERATURE = 0.1;

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
    // Correctif P2-9 (anomalie A6) : le découpage en nœuds variait de 35 à 33 puis
    // de 25 à 29 entre deux exécutions sur les mêmes textes. Une température basse
    // réduit cette dérive d'échantillonnage à la source.
    temperature: EXTRACTION_TEMPERATURE,
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

  // Ordre imposé : le filtre identitaire passe AVANT le filet culturel, pour que
  // l'attribution des fonctions FN* ne puisse jamais s'appuyer sur une inférence
  // relative à l'auteur (note interne du 27/07/2026, anomalie A8).
  const analysis = enforceCulturalRestriction(sanitizeAnalysisIdentity(object));
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;

  return {
    analysis,
    usage: { inputTokens, outputTokens, costUsd: estimateCostUsd(EXTRACTION_MODEL_ID, { inputTokens, outputTokens }) },
  };
}

/**
 * Extraction d'un bloc, stabilisée par consensus (P2-9). Avec
 * `EXTRACTION_CONSENSUS_PASSES = 1` (défaut), se réduit exactement à un appel
 * unique ; au-delà, k extractions sont agrégées et seuls les nœuds confirmés par
 * la majorité des passes sont conservés. Le coût LLM est multiplié par k : le
 * réglage est volontairement explicite.
 */
async function analyzeChunkStabilized(
  text: string,
  meta: PromptMeta,
  onProgress?: (chunkFraction: number) => void,
): Promise<{ analysis: LlmAnalysis; usage: LlmExtractionUsage; variance: ExtractionVariance }> {
  const passes = configuredConsensusPasses();
  const analyses: LlmAnalysis[] = [];
  let usage: LlmExtractionUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

  for (let p = 0; p < passes; p++) {
    const outcome = await analyzeChunk(text, meta, (f) => onProgress?.((p + f) / passes));
    analyses.push(outcome.analysis);
    usage = {
      inputTokens: usage.inputTokens + outcome.usage.inputTokens,
      outputTokens: usage.outputTokens + outcome.usage.outputTokens,
      costUsd: usage.costUsd + outcome.usage.costUsd,
    };
  }

  const { analysis, variance } = consensusMerge(analyses);
  return { analysis, usage, variance };
}

/** Agrège les variances des blocs d'un même texte en une mesure unique. */
function aggregateVariance(parts: ExtractionVariance[]): ExtractionVariance {
  if (parts.length === 1) return parts[0];
  const passes = parts[0]?.passes ?? 1;
  const nodeCounts = parts.reduce<number[]>((acc, v) => {
    v.nodeCounts.forEach((c, i) => (acc[i] = (acc[i] ?? 0) + c));
    return acc;
  }, []);
  const consensusNodes = parts.reduce((s, v) => s + v.consensusNodes, 0);
  const pivotNodes = parts.reduce((s, v) => s + (v.agreementRatio > 0 ? v.consensusNodes / v.agreementRatio : 0), 0);
  const mean = nodeCounts.reduce((s, v) => s + v, 0) / Math.max(1, nodeCounts.length);
  const nodeCountSd =
    nodeCounts.length < 2
      ? 0
      : Math.sqrt(nodeCounts.reduce((s, v) => s + (v - mean) ** 2, 0) / nodeCounts.length);
  return {
    passes,
    nodeCounts,
    nodeCountSd,
    consensusNodes,
    agreementRatio: pivotNodes > 0 ? consensusNodes / pivotNodes : 1,
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
  const variances: ExtractionVariance[] = [];

  if (!needsChunking(text)) {
    const { analysis, usage, variance } = await analyzeChunkStabilized(text, promptMeta, (f) =>
      onProgress?.({ stage: "extracting", fraction: f }),
    );
    merged = analysis;
    totalUsage = usage;
    variances.push(variance);
  } else {
    const chunks: TextChunk[] = chunkText(text);
    const partials: LlmAnalysis[] = [];
    // Séquentiel : respecte le rate limit Anthropic et l'ordre attendu par mergePartialGraphs
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const { analysis, usage, variance } = await analyzeChunkStabilized(chunk.text, promptMeta, (chunkFraction) => {
          const globalFraction = (i + chunkFraction) / chunks.length;
          onProgress?.({
            stage: "extracting",
            fraction: globalFraction,
            chunkIndex: i + 1,
            chunkTotal: chunks.length,
          });
        });
        partials.push(analysis);
        variances.push(variance);
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

  // Point 5 de la note : les vecteurs sémantiques sont calculés une fois ici et
  // transportés dans le graphe, pour que la comparaison reste synchrone et
  // fonctionne sur des graphes rechargés depuis la base. Sans fournisseur
  // configuré, les nœuds ressortent inchangés et le seuil de contenu retombe sur
  // le recouvrement lexical.
  const nodes = await attachNodeEmbeddings(merged.nodes.map(toNarrativeNode));

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
    // P2-9 : la variance inter-exécutions est mesurée et publiée, plutôt que
    // réputée limitée à S_ACT et ST comme l'affirmait la note méthodologique.
    extractionVariance: aggregateVariance(variances),
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
