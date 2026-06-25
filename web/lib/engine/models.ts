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
}
