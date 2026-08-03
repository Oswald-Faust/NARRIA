/**
 * Stabilisation de l'extraction par consensus multi-passes
 * (correctif P2-9 de la note interne du 27/07/2026, anomalie A6 ; révisé en
 * août 2026 après le retour des bêta-testeurs).
 *
 * Deux analyses successives des mêmes textes produisaient 35 puis 33 nœuds côté
 * référence, 25 puis 29 côté candidat. La note méthodologique affirmait que
 * seuls S_ACT et ST étaient instables : c'est inexact, puisque c'est le graphe
 * d'entrée lui-même qui varie — S_ISO, S_GED et S_FUNC héritent donc de cette
 * variance.
 *
 * ─── Révision d'août 2026 ────────────────────────────────────────────────────
 *
 * La première version souffrait de deux défauts que le banc de mesure
 * (`stability.ts`) rend visibles :
 *
 * 1. ELLE ALIGNAIT MAL. Deux nœuds de passes différentes étaient réputés
 *    identiques s'ils partageaient leur code de fonction ET leur RANG relatif
 *    arrondi. Or le rang dépend du nombre total de nœuds : entre une passe de 30
 *    et une passe de 35, le même événement narratif change de rang et cessait
 *    d'être reconnu. L'alignement se fonde désormais sur les COORDONNÉES
 *    TEXTUELLES issues du découpage en blocs — deux nœuds correspondent quand
 *    ils recouvrent le même passage de l'œuvre. Le rang ne sert plus que de
 *    repli, sur les analyses non ancrées, et avec une tolérance d'un cran.
 *
 * 2. ELLE RÉTRÉCISSAIT LE GRAPHE. Le consensus filtrait les nœuds de la seule
 *    passe pivot : un événement vu par toutes les autres passes mais manqué par
 *    le pivot était perdu. Le résultat était donc toujours plus petit que la
 *    passe pivot — on stabilisait en appauvrissant. Le consensus procède
 *    maintenant par REGROUPEMENT : les nœuds de toutes les passes sont réunis en
 *    grappes désignant le même événement, chaque grappe confirmée par la
 *    majorité est retenue, et celles que le pivot ignorait sont RÉINTÉGRÉES à
 *    leur place dans le récit.
 */
import type { LlmAnalysis, LlmNode } from "./llm-schema";

/** Granularité de l'alignement positionnel de repli (8 → tolérance ≈ 12 % du récit). */
const POSITION_BUCKETS = 8;

/**
 * Tolérance de l'alignement de repli, en crans. Un cran d'écart reste le même
 * événement : sans cette tolérance, deux passes de tailles différentes
 * décalaient tous leurs rangs et ne s'alignaient plus nulle part.
 */
const POSITION_TOLERANCE = 1;

/**
 * Recouvrement minimal de deux plages ancrées pour désigner le même événement.
 * Volontairement bas : deux passes peuvent tenir le même épisode pour un peu
 * plus large ou un peu plus étroit sans qu'il s'agisse d'événements distincts.
 */
const ANCHOR_MATCH_IOU = 0.3;

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
  /** Critère d'alignement effectivement employé entre les passes. */
  alignment: "anchors" | "positional";
  /**
   * Nœuds retenus que la passe pivot ne contenait pas : événements vus par la
   * majorité mais manqués par le pivot, que l'ancienne version perdait.
   */
  recoveredNodes: number;
}

interface Span {
  start: number;
  end: number;
}

function nodeSpan(node: LlmNode): Span | null {
  if (node._char_start === undefined || node._char_end === undefined) return null;
  if (node._char_end <= node._char_start) return null;
  return { start: node._char_start, end: node._char_end };
}

function spanIou(a: Span, b: Span): number {
  const intersection = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  if (intersection === 0) return 0;
  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return union > 0 ? intersection / union : 0;
}

/** Position relative d'un nœud dans sa passe, en crans. */
function positionBucket(index: number, total: number): number {
  const position = total > 1 ? index / (total - 1) : 0;
  return Math.round(position * POSITION_BUCKETS);
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

interface Member {
  passIndex: number;
  node: LlmNode;
  /** Rang du nœud dans sa passe, et effectif de celle-ci. */
  index: number;
  total: number;
  span: Span | null;
}

interface Cluster {
  functionCode: string;
  members: Member[];
}

/** Position moyenne d'une grappe, en crans, pour l'alignement de repli. */
function clusterBucket(cluster: Cluster): number {
  const buckets = cluster.members.map((m) => positionBucket(m.index, m.total));
  return buckets.reduce((s, v) => s + v, 0) / buckets.length;
}

/** Début moyen d'une grappe ancrée, pour l'ordonnancement final. */
function clusterStart(cluster: Cluster): number | null {
  const starts = cluster.members.map((m) => m.span?.start).filter((v): v is number => v !== undefined);
  if (starts.length === 0) return null;
  return starts.reduce((s, v) => s + v, 0) / starts.length;
}

/**
 * Score de compatibilité d'un nœud avec une grappe, ou `null` si incompatible.
 *
 * L'ancrage prime : deux nœuds qui recouvrent le même passage désignent le même
 * événement, quel que soit leur rang. À défaut de coordonnées des deux côtés, on
 * retombe sur la proximité de rang, tolérante d'un cran.
 */
function compatibility(cluster: Cluster, member: Member): number | null {
  if (cluster.functionCode !== (member.node.function_code || "")) return null;
  // Une grappe représente UN événement : elle ne peut pas contenir deux nœuds
  // d'une même passe, sans quoi une passe voterait deux fois.
  if (cluster.members.some((m) => m.passIndex === member.passIndex)) return null;

  if (member.span) {
    const ious = cluster.members
      .map((m) => (m.span ? spanIou(m.span, member.span!) : null))
      .filter((v): v is number => v !== null);
    if (ious.length > 0) {
      const best = Math.max(...ious);
      return best >= ANCHOR_MATCH_IOU ? best : null;
    }
  }

  const distance = Math.abs(clusterBucket(cluster) - positionBucket(member.index, member.total));
  if (distance > POSITION_TOLERANCE) return null;
  // Normalisé sous le score d'ancrage minimal, pour qu'un alignement par ancres
  // l'emporte toujours sur un alignement par rang.
  return (ANCHOR_MATCH_IOU * (POSITION_TOLERANCE + 1 - distance)) / (POSITION_TOLERANCE + 2);
}

/**
 * Réunit les nœuds de toutes les passes en grappes désignant le même événement.
 * Chaque nœud rejoint la grappe la plus compatible, ou en ouvre une nouvelle.
 */
function buildClusters(passes: LlmAnalysis[]): Cluster[] {
  const clusters: Cluster[] = [];

  passes.forEach((pass, passIndex) => {
    pass.nodes.forEach((node, index) => {
      const member: Member = {
        passIndex,
        node,
        index,
        total: pass.nodes.length,
        span: nodeSpan(node),
      };

      let best: Cluster | null = null;
      let bestScore = -Infinity;
      for (const cluster of clusters) {
        const score = compatibility(cluster, member);
        if (score !== null && score > bestScore) {
          best = cluster;
          bestScore = score;
        }
      }

      if (best) best.members.push(member);
      else clusters.push({ functionCode: node.function_code || "", members: [member] });
    });
  });

  return clusters;
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
        alignment: passes[0].nodes.some((n) => nodeSpan(n) !== null) ? "anchors" : "positional",
        recoveredNodes: 0,
      },
    };
  }

  const pivot = pivotIndex(nodeCounts);
  const pivotNodes = passes[pivot].nodes;
  const clusters = buildClusters(passes);
  const majority = Math.ceil(passes.length / 2);

  const retained = clusters.filter((c) => c.members.length >= majority);

  // Ordonnancement : par position dans le TEXTE quand les ancres l'autorisent,
  // par rang relatif sinon. Les grappes réintégrées trouvent ainsi leur place
  // exacte, au lieu d'être ajoutées en fin de graphe.
  const anchored = retained.filter((c) => clusterStart(c) !== null).length;
  const useAnchors = anchored > retained.length / 2;

  const ordered = [...retained].sort((a, b) => {
    if (useAnchors) {
      const sa = clusterStart(a);
      const sb = clusterStart(b);
      if (sa !== null && sb !== null) return sa - sb;
      if (sa !== null) return -1;
      if (sb !== null) return 1;
    }
    return clusterBucket(a) - clusterBucket(b);
  });

  // Représentant : le nœud de la passe pivot s'il appartient à la grappe — le
  // pivot reste la référence textuelle — sinon le premier membre rencontré.
  let recoveredNodes = 0;
  const nodes: LlmNode[] = ordered.map((cluster, i) => {
    const fromPivot = cluster.members.find((m) => m.passIndex === pivot);
    if (!fromPivot) recoveredNodes++;
    const representative = (fromPivot ?? cluster.members[0]).node;
    return { ...representative, sequence: i + 1 };
  });

  const pivotRetained = ordered.filter((c) => c.members.some((m) => m.passIndex === pivot)).length;

  return {
    analysis: { ...passes[pivot], nodes },
    variance: {
      passes: passes.length,
      nodeCounts,
      nodeCountSd: standardDeviation(nodeCounts),
      consensusNodes: nodes.length,
      agreementRatio: pivotNodes.length > 0 ? pivotRetained / pivotNodes.length : 1,
      alignment: useAnchors ? "anchors" : "positional",
      recoveredNodes,
    },
  };
}

/** Nombre d'extractions par texte, piloté par l'environnement (défaut : 1, comportement historique). */
export function configuredConsensusPasses(): number {
  const raw = Number(process.env.EXTRACTION_CONSENSUS_PASSES ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(5, Math.max(1, Math.round(raw)));
}
