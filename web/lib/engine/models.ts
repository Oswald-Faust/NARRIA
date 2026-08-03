/**
 * Modèles de données centraux du moteur NARR'IA — port TypeScript fidèle de
 * `narria/core/models.py`. Représentent le graphe narratif (NarRep-Graph).
 */

export interface Modalities {
  vouloir: number;
  devoir: number;
  pouvoir: number;
  savoir: number;
}

export interface NarrativeNode {
  nodeId: string;
  segmentId: string;
  functionCode: string | null;
  functionFamily: string | null;
  functionName: string | null;
  actants: string[];
  modalities: Modalities;
  tension: number;
  phase: string | null;
  textExcerpt: string;
  /**
   * Vecteur sémantique de l'extrait et des actants, calculé à l'extraction
   * (point 5 de la note du 27/07/2026). Absent si aucun fournisseur d'embeddings
   * n'est configuré : le seuil de contenu retombe alors sur la mesure lexicale.
   */
  embedding?: number[];
  /**
   * Ancrage textuel du nœud (août 2026). `blockStart`/`blockEnd` désignent la
   * plage de blocs du découpage déterministe que la fonction recouvre ;
   * `charStart`/`charEnd` en sont les bornes de caractères dans le texte analysé.
   * Absents sur les graphes produits avant l'introduction du découpage par blocs,
   * et sur ceux que l'extraction n'a pas pu ancrer.
   */
  blockStart?: number;
  blockEnd?: number;
  charStart?: number;
  charEnd?: number;
}

export interface NarrativeEdge {
  edgeId: string;
  source: string;
  target: string;
  transitionType: string;
  weight: number;
}

export interface NarrativeGraph {
  graphId: string;
  metadata: Record<string, unknown>;
  nodes: NarrativeNode[];
  edges: NarrativeEdge[];
}

export function functionSequence(g: NarrativeGraph): string[] {
  return g.nodes.filter((n) => n.functionCode).map((n) => n.functionCode as string);
}

export function tensionProfile(g: NarrativeGraph): number[] {
  return g.nodes.map((n) => n.tension);
}

export type SrjLevel = "Faible" | "Modéré" | "Élevé" | "Critique";

export interface Correspondence {
  candNode: string;
  candFunction: string;
  refNode: string;
  refFunction: string;
  similarity: number;
  /**
   * Contenu réel des deux nœuds appariés (correctif P0-3 de la note interne du
   * 27/07/2026) : sans lui, le tableau des correspondances affiche des
   * appariements invérifiables — « n012 (F20) ↔ n007 (F20), 80 % » ne dit pas
   * si les deux scènes racontent la même chose.
   */
  refExcerpt: string;
  candExcerpt: string;
  refActants: string[];
  candActants: string[];
  /** Recouvrement de contenu mesuré entre les deux nœuds (cf. P1-5). */
  contentSimilarity: number;
  /** Poids de spécificité de la fonction appariée (cf. P1-4). */
  specificity: number;
}

/** Couverture de l'appariement (correctif P1-6, anomalie A5). */
export interface CoverageReport {
  refNodes: number;
  candNodes: number;
  /** Nombre de nœuds de chaque graphe effectivement appariés (appariement injectif). */
  refMatched: number;
  candMatched: number;
  refOrphans: number;
  candOrphans: number;
  /** (refMatched + candMatched) / (refNodes + candNodes) ∈ [0, 1]. */
  ratio: number;
}

/**
 * Confinement d'une œuvre dans l'autre — mesure ASYMÉTRIQUE, complémentaire du
 * SNS qui est symétrique par construction.
 *
 * Un Dice compare deux touts : une œuvre confrontée à son propre dixième obtient
 * un score bas, alors qu'il y a reprise intégrale. Le confinement répond à
 * l'autre question : « quelle part de la plus courte se retrouve dans la plus
 * longue ». Structurel (nœuds appariés) et textuel (empreintes de 5 mots), il
 * rend visible le cas de l'extrait, de l'édition tronquée ou du chapitre repris.
 */
export interface InclusionReport {
  /** Part des nœuds de l'œuvre la plus courte expliqués par l'autre ∈ [0, 1]. */
  structural: number;
  /**
   * Même mesure, obtenue par alignement séquentiel autorisant la condensation
   * (août 2026). Contrairement à `structural`, issu d'un couplage injectif, elle
   * sait qu'un épisode du candidat peut en résumer plusieurs de la source — cas
   * que le couplage laissait orphelin. `structural` en retient le maximum.
   */
  sequential: number;
  /** Épisodes absorbés par une fusion : 0 signifie « aucune condensation détectée ». */
  condensedNodes: number;
  /** Épisodes source par épisode candidat sur les étapes fusionnées ; 1 = pas de fusion. */
  condensationRatio: number;
  /** Recouvrement littéral par n-grammes ; `null` si les textes ne sont pas fournis. */
  textual: number | null;
  /** Similarité textuelle globale (Jaccard) ; `null` si les textes ne sont pas fournis. */
  textualJaccard: number | null;
  /** Sens du confinement, `null` si les deux œuvres sont de taille comparable. */
  direction: "cand_in_ref" | "ref_in_cand" | null;
  /** Vrai quand le confinement est assez net pour être signalé dans le verdict. */
  detected: boolean;
}

/** Confrontation des genres détectés (correctifs P0-2 et P1-7, anomalies A3 et A4). */
export interface GenreVerdict {
  refGenre: string;
  candGenre: string;
  /** `null` quand au moins un genre est absent : rien ne peut être affirmé. */
  sameGenre: boolean | null;
  /** Vrai uniquement lorsque les deux genres sont connus ET distincts. */
  crossGenre: boolean;
}

/** Situation du score dans la distribution nulle de son genre (correctif P2-8). */
export interface BaselineVerdict {
  genreKey: string;
  corpusSize: number;
  zScore: number;
  percentile: number;
}

/** Décision d'alerte, explicitée et traçable (§5 de la note : « la paire B ne déclenche plus aucune alerte »). */
export interface AlertVerdict {
  triggered: boolean;
  reason: string;
}

export interface ComparisonResult {
  sns: number;
  snsNormalized: number;
  ss: number;
  st: number;
  srj: number;
  srjLevel: SrjLevel;
  sIso: number;
  sGed: number;
  sFunc: number;
  sAct: number;
  sTens: number;
  detectedModality: string;
  verdict: string;
  correspondences: Correspondence[];
  warnings: string[];
  coverage: CoverageReport;
  /** Confinement d'une œuvre dans l'autre (cas de l'extrait ou de la troncature). */
  inclusion: InclusionReport;
  genre: GenreVerdict;
  /** Vrai si la normalisation par genre a effectivement été appliquée à SNS_N. */
  normalizationApplied: boolean;
  baseline: BaselineVerdict | null;
  alert: AlertVerdict;
}

export interface LlmAnalysisMetadata {
  mode: "llm";
  summary: string;
  genre: string;
  tradition: string;
  formalFeatures: Record<string, unknown>;
  mainActants: {
    v1: Record<string, string>;
    v2: Record<string, string>;
  };
  thematicKeywords: string[];
  costUsd: number;
  tokensTotal: number;
  mergeInfo?: { nChunks: number; nNodesBeforeDedup: number; nNodesAfterDedup: number; nDuplicatesRemoved: number };
  /** Variance inter-exécutions de l'extraction (correctif P2-9, anomalie A6). */
  extractionVariance?: {
    passes: number;
    nodeCounts: number[];
    nodeCountSd: number;
    consensusNodes: number;
    agreementRatio: number;
  };
}
