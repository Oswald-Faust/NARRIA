/**
 * Stabilisation de l'extraction par consensus multi-passes
 * (correctif P2-9 de la note interne du 27/07/2026, anomalie A6).
 *
 * Deux analyses successives des mêmes textes produisaient 35 puis 33 nœuds côté
 * référence, 25 puis 29 côté candidat. La note méthodologique affirmait que
 * seuls S_ACT et ST étaient instables : c'est inexact, puisque c'est le graphe
 * d'entrée lui-même qui varie — S_ISO, S_GED et S_FUNC héritent donc de cette
 * variance.
 *
 * On agrège ici k extractions indépendantes : un nœud n'est retenu que s'il
 * apparaît, à la même fonction et à la même position relative dans le récit,
 * dans la majorité des passes. La variance inter-exécutions est mesurée et
 * publiée plutôt que passée sous silence.
 */
import type { LlmAnalysis, LlmNode } from "./llm-schema";

/** Granularité de l'alignement positionnel entre passes (8 → tolérance ≈ 12 % du récit). */
const POSITION_BUCKETS = 8;

export interface ExtractionVariance {
  /** Nombre d'extractions agrégées. */
  passes: number;
  /** Nombre de nœuds produits par chaque passe, avant consensus. */
  nodeCounts: number[];
  /** Écart-type du nombre de nœuds entre passes (0 si une seule passe). */
  nodeCountSd: number;
  /** Nœuds retenus par le consensus. */
  consensusNodes: number;
  /** Part des nœuds de la passe pivot confirmés par la majorité des passes. */
  agreementRatio: number;
}

/** Clé d'alignement d'un nœud entre passes : fonction + position relative bucketisée. */
function consensusKey(node: LlmNode, index: number, total: number): string {
  const position = total > 1 ? index / (total - 1) : 0;
  return `${node.function_code}@${Math.round(position * POSITION_BUCKETS)}`;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Passe dont le nombre de nœuds est le plus proche de la médiane : sert de référence textuelle. */
function pivotIndex(counts: number[]): number {
  const sorted = [...counts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let best = 0;
  let bestDistance = Infinity;
  counts.forEach((c, i) => {
    const d = Math.abs(c - median);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

export interface ConsensusOutcome {
  analysis: LlmAnalysis;
  variance: ExtractionVariance;
}

/**
 * Agrège k extractions du même texte. Avec une seule passe, retourne l'analyse
 * inchangée et une variance nulle — le comportement par défaut reste identique
 * tant que `EXTRACTION_CONSENSUS_PASSES` n'est pas relevé.
 */
export function consensusMerge(passes: LlmAnalysis[]): ConsensusOutcome {
  if (passes.length === 0) throw new Error("consensusMerge : aucune passe d'extraction fournie.");

  const nodeCounts = passes.map((p) => p.nodes.length);

  if (passes.length === 1) {
    return {
      analysis: passes[0],
      variance: {
        passes: 1,
        nodeCounts,
        nodeCountSd: 0,
        consensusNodes: passes[0].nodes.length,
        agreementRatio: 1,
      },
    };
  }

  // Nombre de passes distinctes dans lesquelles chaque clé apparaît.
  const support = new Map<string, number>();
  for (const pass of passes) {
    const seen = new Set<string>();
    pass.nodes.forEach((node, i) => seen.add(consensusKey(node, i, pass.nodes.length)));
    for (const key of seen) support.set(key, (support.get(key) ?? 0) + 1);
  }

  const majority = Math.ceil(passes.length / 2);
  const pivot = passes[pivotIndex(nodeCounts)];
  const retained = pivot.nodes.filter(
    (node, i) => (support.get(consensusKey(node, i, pivot.nodes.length)) ?? 0) >= majority,
  );
  // Renumérote la séquence pour rester continue après élimination des nœuds isolés.
  const nodes = retained.map((node, i) => ({ ...node, sequence: i + 1 }));

  return {
    analysis: { ...pivot, nodes },
    variance: {
      passes: passes.length,
      nodeCounts,
      nodeCountSd: standardDeviation(nodeCounts),
      consensusNodes: nodes.length,
      agreementRatio: pivot.nodes.length > 0 ? nodes.length / pivot.nodes.length : 1,
    },
  };
}

/** Nombre d'extractions par texte, piloté par l'environnement (défaut : 1, comportement historique). */
export function configuredConsensusPasses(): number {
  const raw = Number(process.env.EXTRACTION_CONSENSUS_PASSES ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(5, Math.max(1, Math.round(raw)));
}
