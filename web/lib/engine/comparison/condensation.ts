/**
 * Alignement séquentiel des graphes narratifs, avec condensation.
 *
 * ─── Pourquoi ce module ─────────────────────────────────────────────────────
 *
 * Objection des bêta-testeurs, août 2026 : « l'outil devrait être capable de
 * détecter la condensation en cherchant si l'œuvre candidate est un sous-graphe
 * de l'œuvre source ». Le moteur en était structurellement incapable, pour deux
 * raisons cumulées :
 *
 * 1. L'appariement de S_ISO est INJECTIF (hongrois) : un nœud du candidat ne
 *    peut expliquer qu'un seul nœud de la référence. Or condenser, c'est
 *    précisément fondre trois épisodes de la source en un seul du candidat. Le
 *    couplage biparti laissait donc deux des trois épisodes orphelins et
 *    concluait à une couverture partielle là où la reprise était intégrale.
 * 2. S_ISO et S_GED ignorent l'ORDRE. Deux œuvres partageant les mêmes fonctions
 *    dans un ordre inverse y obtiennent le même score que deux œuvres qui
 *    racontent la même histoire. Seule S_FUNC tient compte de la succession, via
 *    une LCS elle aussi strictement un-pour-un.
 *
 * Ce module fournit ce qui manquait : un alignement MONOTONE (il respecte
 * l'ordre du sjuzet) et PLUSIEURS-VERS-UN (il modélise la condensation et son
 * inverse, l'amplification). C'est l'outil approprié pour comparer deux
 * séquences narratives, là où le couplage biparti traite les nœuds comme un sac.
 *
 * ─── Comment ────────────────────────────────────────────────────────────────
 *
 * Programmation dynamique de type Needleman–Wunsch généralisée. Depuis l'état
 * « i nœuds de référence et j nœuds candidats consommés », cinq transitions :
 *
 *   • correspondance   ref[i−1] ↔ cand[j−1]
 *   • condensation     ref[i−k … i−1] → cand[j−1]        (k épisodes résumés en un)
 *   • amplification    ref[i−1]       → cand[j−k … j−1]  (un épisode développé en k)
 *   • saut de référence  ref[i−1] sans correspondance    (passage non repris)
 *   • saut de candidat   cand[j−1] sans correspondance   (passage ajouté)
 *
 * Le score d'une fusion se mesure sur le nœud SYNTHÉTIQUE réunissant les
 * épisodes fondus — extraits concaténés, actants réunis — et non sur le meilleur
 * de ses membres : un résumé authentique porte des traces de TOUS les épisodes
 * qu'il condense, et ce critère écarte les fusions opportunistes où un seul
 * épisode explique le rapprochement.
 *
 * Le facteur de fusion est plafonné (`maxMerge`) : au-delà, « condensation »
 * cesse de décrire une opération d'écriture identifiable et devient un
 * fourre-tout capable d'expliquer n'importe quel rapprochement.
 */
import type { NarrativeGraph, NarrativeNode } from "../models";
import { CONTENT_MATCH_THRESHOLD, type ContentSimilarityFn } from "./content-similarity";

/** Nombre maximal d'épisodes fondus en un seul (au-delà : plus une condensation). */
const DEFAULT_MAX_MERGE = 4;

/**
 * Pénalité d'une fusion, appliquée par épisode absorbé au-delà du premier.
 * Sans elle, l'alignement préférerait toujours fondre : une fusion explique
 * plusieurs nœuds pour le prix d'un.
 */
const MERGE_PENALTY = 0.15;

/** Score minimal pour qu'une étape soit retenue plutôt qu'un double saut. */
const MIN_STEP_SCORE = CONTENT_MATCH_THRESHOLD;

/**
 * Trace minimale que CHAQUE épisode fusionné doit laisser dans l'épisode opposé.
 *
 * Ce garde-fou est indispensable : la similarité de contenu est un coefficient
 * de recouvrement, `intersection / plus petit ensemble`. Mesurée entre un groupe
 * fusionné (vocabulaire large) et un épisode isolé (vocabulaire étroit), elle
 * peut valoir 1 alors qu'un SEUL membre du groupe explique le rapprochement —
 * les autres seraient alors absorbés gratuitement, et la condensation
 * expliquerait n'importe quoi. On exige donc que le membre le plus faible du
 * groupe se retrouve, lui aussi, dans le résumé.
 */
const MIN_MEMBER_CONTENT = CONTENT_MATCH_THRESHOLD / 2;

export type StepKind = "correspondance" | "condensation" | "amplification";

export interface AlignmentStep {
  kind: StepKind;
  refNodes: string[];
  candNodes: string[];
  score: number;
}

export interface SequenceAlignment {
  steps: AlignmentStep[];
  /** Nœuds de la référence expliqués par l'alignement. */
  refCovered: number;
  /** Nœuds du candidat expliqués par l'alignement. */
  candCovered: number;
  /**
   * Part de l'œuvre la plus COURTE que l'autre explique. C'est la mesure
   * d'inclusion : une œuvre condensée est intégralement contenue dans sa source
   * même si la source contient bien davantage.
   */
  containment: number;
  /** Étapes fondant plusieurs épisodes en un seul. */
  condensedSteps: number;
  /** Épisodes absorbés par une fusion, au-delà du premier de chaque étape. */
  absorbedNodes: number;
  /**
   * Rapport moyen d'épisodes source par épisode candidat sur les étapes de
   * fusion ; vaut 1 quand aucune condensation n'a eu lieu.
   */
  condensationRatio: number;
  /** Sens de la fusion dominante, `null` si aucune ou si les deux s'équilibrent. */
  direction: "cand_condenses_ref" | "ref_condenses_cand" | null;
  /** Score cumulé de l'alignement, normalisé par l'effectif de l'œuvre courte. */
  score: number;
}

export interface AlignmentOptions {
  contentSimilarity: ContentSimilarityFn;
  /** Similarité d'étiquette, injectée pour rester cohérente avec S_ISO. */
  labelSimilarity: (a: NarrativeNode, b: NarrativeNode) => number;
  maxMerge?: number;
}

/**
 * Nœud synthétique réunissant plusieurs épisodes contigus. Sert à mesurer si un
 * épisode de l'autre œuvre les condense réellement TOUS.
 *
 * Le code de fonction retenu est celui du premier épisode : la fonction d'un
 * groupe condensé est mal définie, et l'étiquette ne pèse que faiblement dans le
 * score de fusion — c'est le contenu qui tranche.
 */
function mergeNodes(nodes: NarrativeNode[]): NarrativeNode {
  if (nodes.length === 1) return nodes[0];
  const actants = [...new Set(nodes.flatMap((n) => n.actants ?? []))];
  return {
    ...nodes[0],
    nodeId: nodes.map((n) => n.nodeId).join("+"),
    actants,
    textExcerpt: nodes.map((n) => n.textExcerpt ?? "").join(" "),
    // Le vecteur du premier épisode ne représenterait pas le groupe : on le
    // retire pour forcer la mesure lexicale, seule fiable sur un agrégat.
    embedding: undefined,
    tension: nodes.reduce((s, n) => s + n.tension, 0) / nodes.length,
  };
}

/**
 * Score d'une étape. Combine l'étiquette et le contenu, comme S_ISO, puis
 * pénalise chaque épisode absorbé au-delà du premier.
 *
 * Retourne 0 lorsque le contenu ne se recoupe pas assez : une étape ne doit
 * jamais être préférée à un double saut sur la seule foi d'étiquettes communes —
 * c'est l'anomalie A1 (un combat contre un dragon apparié à une neutralisation
 * de terroriste au motif que tous deux portent F20).
 */
function stepScore(
  refGroup: NarrativeNode[],
  candGroup: NarrativeNode[],
  options: AlignmentOptions,
): number {
  const ref = mergeNodes(refGroup);
  const cand = mergeNodes(candGroup);

  const content = options.contentSimilarity(ref, cand);
  if (content < CONTENT_MATCH_THRESHOLD) return 0;

  // Chaque épisode fusionné doit contribuer : sans cela, un groupe de trois
  // serait retenu au seul mérite de l'un d'eux.
  if (refGroup.length > 1 || candGroup.length > 1) {
    const weakestRef = Math.min(...refGroup.map((r) => options.contentSimilarity(r, cand)));
    const weakestCand = Math.min(...candGroup.map((c) => options.contentSimilarity(ref, c)));
    if (Math.min(weakestRef, weakestCand) < MIN_MEMBER_CONTENT) return 0;
  }

  const label = options.labelSimilarity(ref, cand);
  const base = 0.5 * label + 0.5 * content;

  // Qualité intrinsèque de l'étape, fusion pénalisée. Sous le seuil, l'étape est
  // rejetée : mieux vaut deux épisodes inexpliqués qu'un rapprochement douteux.
  const absorbed = refGroup.length + candGroup.length - 2;
  const quality = base - MERGE_PENALTY * absorbed;
  if (quality < MIN_STEP_SCORE) return 0;

  // Pondération par la COUVERTURE. Sans elle, l'alignement n'aurait aucune
  // raison de fusionner : sauter un épisode ne coûte rien, tandis que l'absorber
  // coûte `MERGE_PENALTY`. L'optimum serait alors d'apparier un seul épisode du
  // groupe et d'abandonner les autres — exactement le comportement du couplage
  // injectif que ce module est censé dépasser. Une étape vaut donc ce qu'elle
  // explique.
  const explained = (refGroup.length + candGroup.length) / 2;
  return quality * explained;
}

interface Cell {
  score: number;
  /** Nombre de nœuds consommés de chaque côté pour atteindre cette cellule. */
  backRef: number;
  backCand: number;
  kind: StepKind | null;
  stepScore: number;
}

/**
 * Aligne deux graphes narratifs en respectant l'ordre et en autorisant les
 * fusions. Complexité O(n · m · k) — quelques dizaines de milliers d'opérations
 * sur des graphes de 35 nœuds, sans conséquence pratique.
 */
export function alignSequences(
  gRef: NarrativeGraph,
  gCand: NarrativeGraph,
  options: AlignmentOptions,
): SequenceAlignment {
  const refNodes = gRef.nodes;
  const candNodes = gCand.nodes;
  const n = refNodes.length;
  const m = candNodes.length;

  const empty: SequenceAlignment = {
    steps: [], refCovered: 0, candCovered: 0, containment: 0,
    condensedSteps: 0, absorbedNodes: 0, condensationRatio: 1,
    direction: null, score: 0,
  };
  if (n === 0 || m === 0) return empty;

  const maxMerge = Math.max(1, options.maxMerge ?? DEFAULT_MAX_MERGE);

  const dp: Cell[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => ({
      score: 0, backRef: 0, backCand: 0, kind: null, stepScore: 0,
    })),
  );

  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (i === 0 && j === 0) continue;

      let best: Cell = { score: -Infinity, backRef: 0, backCand: 0, kind: null, stepScore: 0 };

      // Sauts : un épisode reste inexpliqué. Sans pénalité — l'inclusion tolère
      // qu'une source contienne bien plus que son extrait ; c'est la couverture
      // de l'œuvre COURTE qui juge, pas la longueur de l'autre.
      if (i > 0 && dp[i - 1][j].score > best.score) {
        best = { score: dp[i - 1][j].score, backRef: 1, backCand: 0, kind: null, stepScore: 0 };
      }
      if (j > 0 && dp[i][j - 1].score > best.score) {
        best = { score: dp[i][j - 1].score, backRef: 0, backCand: 1, kind: null, stepScore: 0 };
      }

      // Correspondance et condensation : k épisodes de référence → 1 candidat.
      if (j > 0) {
        for (let k = 1; k <= Math.min(maxMerge, i); k++) {
          const refGroup = refNodes.slice(i - k, i);
          const s = stepScore(refGroup, [candNodes[j - 1]], options);
          if (s <= 0) continue;
          const total = dp[i - k][j - 1].score + s;
          if (total > best.score) {
            best = {
              score: total,
              backRef: k,
              backCand: 1,
              kind: k === 1 ? "correspondance" : "condensation",
              stepScore: s,
            };
          }
        }
      }

      // Amplification : 1 épisode de référence → k candidats.
      if (i > 0) {
        for (let k = 2; k <= Math.min(maxMerge, j); k++) {
          const candGroup = candNodes.slice(j - k, j);
          const s = stepScore([refNodes[i - 1]], candGroup, options);
          if (s <= 0) continue;
          const total = dp[i - 1][j - k].score + s;
          if (total > best.score) {
            best = { score: total, backRef: 1, backCand: k, kind: "amplification", stepScore: s };
          }
        }
      }

      dp[i][j] = best.score === -Infinity
        ? { score: 0, backRef: 0, backCand: 0, kind: null, stepScore: 0 }
        : best;
    }
  }

  // Remontée du chemin optimal.
  const steps: AlignmentStep[] = [];
  let i = n;
  let j = m;
  let refCovered = 0;
  let candCovered = 0;
  let condensedSteps = 0;
  let absorbedNodes = 0;
  let refFused = 0;
  let candFused = 0;

  while (i > 0 || j > 0) {
    const cell = dp[i][j];
    if (cell.backRef === 0 && cell.backCand === 0) break; // sécurité
    if (cell.kind) {
      const refGroup = refNodes.slice(i - cell.backRef, i);
      const candGroup = candNodes.slice(j - cell.backCand, j);
      steps.push({
        kind: cell.kind,
        refNodes: refGroup.map((x) => x.nodeId),
        candNodes: candGroup.map((x) => x.nodeId),
        score: cell.stepScore,
      });
      refCovered += refGroup.length;
      candCovered += candGroup.length;
      if (cell.kind !== "correspondance") {
        condensedSteps++;
        absorbedNodes += refGroup.length + candGroup.length - 2;
        if (cell.kind === "condensation") refFused += refGroup.length;
        else candFused += candGroup.length;
      }
    }
    i -= cell.backRef;
    j -= cell.backCand;
  }
  steps.reverse();

  const shorter = Math.min(n, m);
  const covered = n <= m ? refCovered : candCovered;
  const fusionSteps = condensedSteps || 1;

  return {
    steps,
    refCovered,
    candCovered,
    containment: shorter > 0 ? covered / shorter : 0,
    condensedSteps,
    absorbedNodes,
    condensationRatio: condensedSteps > 0 ? (refFused + candFused) / fusionSteps : 1,
    direction:
      refFused === candFused ? null : refFused > candFused ? "cand_condenses_ref" : "ref_condenses_cand",
    score: shorter > 0 ? dp[n][m].score / shorter : 0,
  };
}
