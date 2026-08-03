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
import {
  chunkText,
  mergePartialGraphs,
  estimateTokens,
  CHUNK_THRESHOLD_TOKENS,
  TARGET_CHUNK_TOKENS,
  type TextChunk,
} from "./chunker";
import {
  splitIntoBlocks,
  toJsonBlocks,
  renderBlocksForPrompt,
  charRangeForBlocks,
  type NarrativeBlock,
} from "../segmentation/block-splitter";
import { consensusMerge, configuredConsensusPasses, type ExtractionVariance } from "./consensus";
import { attachNodeEmbeddings } from "../comparison/embeddings";
import type { NarrativeGraph, NarrativeNode, NarrativeEdge, LlmAnalysisMetadata } from "../models";
import { estimateCostUsd } from "@/lib/pricing";

export const EXTRACTION_MODEL_ID = "claude-sonnet-4-6";

/**
 * Température d'extraction — nulle. Le découpage en nœuds et l'étiquetage des
 * fonctions relèvent de l'analyse, pas de la génération : rien ne justifie un
 * échantillonnage aléatoire. Les bêta-testeurs ont montré qu'une même œuvre
 * produisait 19 puis 27 nœuds d'une exécution à l'autre, créant des orphelins
 * purement artificiels lors de la comparaison. (Une température nulle réduit
 * fortement cette dérive sans la supprimer : le cache par empreinte de texte,
 * en amont, garantit seul la stabilité stricte sur un texte déjà analysé.)
 */
export const EXTRACTION_TEMPERATURE = 0;

/**
 * Pré-découpage déterministe du texte en blocs avant extraction (août 2026,
 * règles impératives des bêta-testeurs). Actif par défaut ; `NARRIA_BLOCK_SPLIT=off`
 * rétablit le comportement antérieur, où le modèle posait lui-même les frontières.
 *
 * L'intérêt n'est pas seulement la conformité aux règles demandées : en fixant
 * les frontières hors du modèle, on retire au découpage sa part
 * d'échantillonnage — c'était la source documentée de la dérive « 33 puis 35
 * nœuds sur le même texte » (cf. `consensus.ts`) — et on donne aux nœuds des
 * coordonnées textuelles vérifiables, sans lesquelles l'inclusion d'une œuvre
 * dans une autre ne peut pas être testée.
 */
export function blockSplittingEnabled(): boolean {
  return (process.env.NARRIA_BLOCK_SPLIT ?? "on").toLowerCase() !== "off";
}

/**
 * Reporte sur chaque nœud les bornes de caractères correspondant à la plage de
 * blocs qu'il déclare. Un ancrage absent, inversé ou hors champ est ignoré
 * silencieusement : l'ancrage enrichit le graphe, il ne conditionne pas
 * l'analyse. Les offsets sont relatifs au TEXTE SOUMIS à l'appel — donc au
 * texte entier hors chunking, et au bloc de découpe au-delà du seuil de
 * chunking.
 */
/**
 * Facteur d'expansion du prompt dû aux repères de blocs (`[12] `).
 *
 * Le seuil de découpe en chunks porte sur le texte NU ; or c'est le texte
 * NUMÉROTÉ qui part au modèle, et sur une prose dialoguée le découpage produit
 * un bloc tous les huit mots environ — soit, sur un roman, plusieurs dizaines de
 * milliers de tokens de repères. Sans cette correction, un texte mesuré sous le
 * seuil déborderait la fenêtre de contexte à l'exécution.
 *
 * Retourne 1 quand le découpage est inactif ou le texte vide.
 */
export function blockPromptExpansion(text: string): number {
  if (!blockSplittingEnabled()) return 1;
  const raw = estimateTokens(text);
  if (raw === 0) return 1;
  const blocks = splitIntoBlocks(text);
  if (blocks.length === 0) return 1;
  return Math.max(1, estimateTokens(renderBlocksForPrompt(blocks)) / raw);
}

export function anchorNodesToBlocks(analysis: LlmAnalysis, blocks: NarrativeBlock[]): LlmAnalysis {
  if (blocks.length === 0) return analysis;
  let anchored = false;

  const nodes = analysis.nodes.map((node) => {
    if (node.block_start === undefined) return node;
    const end = node.block_end ?? node.block_start;
    const range = charRangeForBlocks(blocks, node.block_start, end);
    if (!range) return node;
    anchored = true;
    return {
      ...node,
      block_start: Math.min(node.block_start, end),
      block_end: Math.max(node.block_start, end),
      _char_start: range.startChar,
      _char_end: range.endChar,
    };
  });

  return anchored ? { ...analysis, nodes } : analysis;
}

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

  // Découpage déterministe préalable : les frontières sont posées ici, en code,
  // et le modèle s'y réfère au lieu de les inventer.
  const blocks = blockSplittingEnabled() ? splitIntoBlocks(text) : [];

  const result = streamObject({
    model: anthropic(EXTRACTION_MODEL_ID),
    system: SYSTEM_PROMPT_NARRATOLOGY,
    prompt: buildUserPrompt(text, meta, blocks.length > 0 ? toJsonBlocks(blocks) : undefined),
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
  const analysis = anchorNodesToBlocks(
    enforceCulturalRestriction(sanitizeAnalysisIdentity(object)),
    blocks,
  );
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
    // L'alignement par ancres n'est revendiqué que si TOUS les blocs de découpe
    // en ont bénéficié : une seule partie non ancrée rend la mesure hétérogène.
    alignment: parts.every((v) => v.alignment === "anchors") ? "anchors" : "positional",
    recoveredNodes: parts.reduce((s, v) => s + v.recoveredNodes, 0),
  };
}

function nodeIdFor(index: number): string {
  return `n${String(index + 1).padStart(3, "0")}`;
}

function toNarrativeNode(node: LlmNode, index: number): NarrativeNode {
  return {
    nodeId: nodeIdFor(index),
    // Quand le nœud est ancré, le segment porte la plage de blocs qu'il recouvre :
    // l'identifiant devient une coordonnée dans le texte, et non plus un simple
    // numéro d'ordre. C'est ce qui rend la comparaison de structures vérifiable.
    segmentId:
      node.block_start !== undefined
        ? `b${node.block_start}-${node.block_end ?? node.block_start}`
        : `seg_${nodeIdFor(index)}`,
    functionCode: node.function_code || null,
    functionFamily: node.function_family || null,
    functionName: node.function_name || null,
    actants: node.actants,
    modalities: node.modalities,
    tension: node.tension,
    phase: node.phase || null,
    textExcerpt: node.text_excerpt,
    ...(node.block_start !== undefined
      ? { blockStart: node.block_start, blockEnd: node.block_end ?? node.block_start }
      : {}),
    ...(node._char_start !== undefined
      ? { charStart: node._char_start, charEnd: node._char_end }
      : {}),
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

  // Le seuil porte sur le prompt réellement envoyé, repères de blocs compris.
  const expansion = blockPromptExpansion(text);
  const promptTokens = estimateTokens(text) * expansion;

  if (promptTokens <= CHUNK_THRESHOLD_TOKENS) {
    const { analysis, usage, variance } = await analyzeChunkStabilized(text, promptMeta, (f) =>
      onProgress?.({ stage: "extracting", fraction: f }),
    );
    merged = analysis;
    totalUsage = usage;
    variances.push(variance);
  } else {
    // Cible de découpe réduite du même facteur, pour que chaque bloc de texte
    // reste sous la cible UNE FOIS numéroté.
    const chunks: TextChunk[] = chunkText(text, Math.floor(TARGET_CHUNK_TOKENS / expansion));
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
