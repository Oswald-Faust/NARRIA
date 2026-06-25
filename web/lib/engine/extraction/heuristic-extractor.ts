/**
 * Module 2 — Extraction heuristique du graphe narratif. Port fidèle de
 * `narria/m2_extraction/extractor.py` (chemin local, sans LLM).
 */
import type {
  NarrativeGraph,
  NarrativeNode,
  NarrativeEdge,
  Modalities,
} from "../models";
import type { NarrativeSegment } from "../segmentation/segmenter";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function hasWord(textLower: string, kw: string): boolean {
  return new RegExp(`\\b${escapeRegExp(kw)}\\b`).test(textLower);
}

type Pattern = [keywords: string[], code: string, name: string, family: string];

const FUNCTION_PATTERNS: Pattern[] = [
  [["part", "partit", "quitte", "quitta"], "F01", "Départ", "Rupture"],
  [["voulut", "veut", "décide", "décida", "cherche", "chercha", "recherche"], "F02", "Désir / Quête", "Rupture"],
  [["manque", "manqua", "privé", "orphelin", "abandonné"], "F03", "Manque", "Rupture"],
  [["rencontre", "rencontra", "arrive", "arriva", "trouve", "trouva"], "F10", "Rencontre", "Quête"],
  [["reçut", "reçoit", "donna", "donne", "offre"], "F11", "Don / Réception", "Quête"],
  [["entra", "entre", "pénètre", "pénétra"], "F12", "Entrée dans l'épreuve", "Quête"],
  [["frappe", "frappa", "attaque", "attaqua", "combat", "combattit"], "F20", "Combat", "Obstacle"],
  [["trahit", "trahison", "trahi"], "F21", "Trahison", "Obstacle"],
  [["menace", "menaça"], "F22", "Menace", "Obstacle"],
  [["tue", "tua", "meurtre", "assassina"], "F23", "Meurtre", "Obstacle"],
  [["blessa", "blesse"], "F24", "Blessure", "Obstacle"],
  [["découvre", "découvrit", "comprend", "comprit", "apprend", "apprit"], "F30", "Reconnaissance", "Pivot"],
  [["révèle", "révéla", "avoue", "avoua"], "F31", "Révélation", "Pivot"],
  [["cache", "cacha", "dissimule"], "F32", "Dissimulation", "Pivot"],
  [["sauve", "sauva", "libère", "libéra"], "F40", "Libération / Sauvetage", "Résolution"],
  [["triomphe", "vainqueur", "gagna", "gagne"], "F41", "Triomphe", "Résolution"],
  [["échoue", "échoua", "perdit"], "F42", "Échec", "Résolution"],
  [["meurt", "mourut", "mort"], "F43", "Mort", "Résolution"],
  [["pardonne", "pardonna"], "F44", "Pardon", "Résolution"],
  [["vengea", "venge", "vengeance"], "F45", "Vengeance", "Résolution"],
  [["aime", "aima", "amour", "éprit"], "F50", "Amour", "Liaison"],
  [["épouse", "épousa", "mariage"], "F51", "Union / Mariage", "Liaison"],
  [["rejette", "rejeta", "refusa", "refuse"], "F52", "Rejet", "Liaison"],
  [["bénit", "bénédiction"], "FNBENI", "Bénédiction", "Liaison africaine"],
  [["maudit", "malédiction"], "FNMALA", "Malédiction", "Obstacle africain"],
  [["ancêtre", "ancêtres", "esprits", "rêve", "vision"], "FNANC", "Ancêtre-arbitre", "Pivot africain"],
  [["proverbe", "sagesse", "parole"], "FNPROV", "Proverbe narratif", "Liaison africaine"],
  [["griot", "conte", "raconta"], "FNGR", "Griot-narrateur", "Liaison africaine"],
  [["alliance", "clan", "famille", "tribu"], "FNAL", "Alliance matrimoniale/clanique", "Liaison africaine"],
  [["communauté", "assemblée", "village", "peuple"], "FNCOMM", "Interpellation communautaire", "Liaison africaine"],
];

// Indicateurs de phase dramatique (ordre d'insertion important).
const PHASE_INDICATORS: [string, string[]][] = [
  ["Exposition", []],
  ["Complication", ["mais", "cependant", "soudain", "or"]],
  ["Climax", ["alors", "enfin", "moment"]],
  ["Résolution", ["finalement", "ainsi", "depuis lors", "à la fin"]],
];

const HIGH_TENSION = ["combat", "guerre", "mort", "tue", "tua", "trahison", "blessa",
  "terrible", "horreur", "cri", "hurla", "sang", "douleur", "attaque", "fuir", "paniqua", "déchira"];
const LOW_TENSION = ["calme", "paix", "sereine", "doux", "lumineux", "heureux",
  "tranquille", "pardonna", "embrassa", "sourit"];

function identifyFunction(text: string): [string | null, string | null, string | null] {
  const lower = text.toLowerCase();
  const scores: [number, string, string, string][] = [];
  for (const [keywords, code, name, family] of FUNCTION_PATTERNS) {
    let matches = 0;
    for (const kw of keywords) if (hasWord(lower, kw)) matches += 1;
    if (matches > 0) scores.push([matches, code, name, family]);
  }
  if (!scores.length) return [null, null, null];
  scores.sort((a, b) => b[0] - a[0]); // tri stable : ties gardent l'ordre des patterns
  const [, code, name, family] = scores[0];
  return [code, name, family];
}

function identifyPhase(text: string, position: number, total: number): string {
  const lower = text.toLowerCase();
  for (const [phase, indicators] of PHASE_INDICATORS) {
    for (const ind of indicators) {
      if (hasWord(lower, ind)) return phase;
    }
  }
  const ratio = position / Math.max(total - 1, 1);
  if (ratio < 0.2) return "Exposition";
  if (ratio < 0.55) return "Complication";
  if (ratio < 0.8) return "Climax";
  return "Résolution";
}

function estimateTension(text: string, position: number, total: number): number {
  const lower = text.toLowerCase();
  const base = 0.3 + 0.5 * (1 - Math.abs(position / Math.max(total - 1, 1) - 0.7));
  const h = HIGH_TENSION.filter((w) => lower.includes(w)).length;
  const l = LOW_TENSION.filter((w) => lower.includes(w)).length;
  const tension = base + 0.08 * h - 0.05 * l;
  return Math.max(0, Math.min(1, tension));
}

function estimateModalities(text: string): Modalities {
  const lower = text.toLowerCase();
  const score = (keywords: string[]) =>
    Math.min(1.0, keywords.reduce((s, kw) => s + (lower.includes(kw) ? 0.3 : 0), 0));
  return {
    vouloir: score(["veut", "voulut", "désire", "désira", "souhaite", "souhaita", "rêve"]),
    devoir: score(["doit", "dut", "faut", "fallut", "doit", "obligé", "promet", "promit"]),
    pouvoir: score(["peut", "pouvait", "put", "parvient", "parvint", "réussit"]),
    savoir: score(["sait", "savait", "sut", "apprend", "apprit", "découvrit", "comprit"]),
  };
}

function classifyTransition(src: NarrativeNode, tgt: NarrativeNode): string {
  const shared = src.actants.filter((a) => tgt.actants.includes(a));
  if (shared.length) return "causal";
  if (src.phase !== tgt.phase) return "temporal";
  return "sequential";
}

function buildNode(seg: NarrativeSegment, position: number, total: number): NarrativeNode {
  const [code, name, family] = identifyFunction(seg.text);
  return {
    nodeId: `n${String(position + 1).padStart(3, "0")}`,
    segmentId: seg.segmentId,
    functionCode: code,
    functionName: name,
    functionFamily: family,
    actants: seg.entities.slice(0, 6),
    modalities: estimateModalities(seg.text),
    tension: estimateTension(seg.text, position, total),
    phase: identifyPhase(seg.text, position, total),
    textExcerpt: seg.text.slice(0, 150),
  };
}

let GRAPH_COUNTER = 0;
function graphId(): string {
  GRAPH_COUNTER += 1;
  return `g_${Date.now().toString(36)}${GRAPH_COUNTER}`;
}

export function extractGraph(
  segments: NarrativeSegment[],
  metadata: Record<string, unknown> = {},
): NarrativeGraph {
  const graph: NarrativeGraph = { graphId: graphId(), metadata, nodes: [], edges: [] };
  const n = segments.length;
  if (n === 0) return graph;

  segments.forEach((seg, i) => graph.nodes.push(buildNode(seg, i, n)));

  for (let i = 0; i < graph.nodes.length - 1; i++) {
    const src = graph.nodes[i];
    const tgt = graph.nodes[i + 1];
    graph.edges.push({
      edgeId: `e_${String(i).padStart(3, "0")}`,
      source: src.nodeId,
      target: tgt.nodeId,
      transitionType: classifyTransition(src, tgt),
      weight: 1.0,
    });
  }

  // Arêtes causales distantes (actants fortement partagés). N'affecte pas le scoring.
  for (let i = 0; i < graph.nodes.length - 2; i++) {
    for (let j = i + 2; j < Math.min(i + 5, graph.nodes.length); j++) {
      const shared = graph.nodes[i].actants.filter((a) => graph.nodes[j].actants.includes(a));
      if (shared.length >= 2) {
        graph.edges.push({
          edgeId: `ec_${String(i).padStart(3, "0")}_${String(j).padStart(3, "0")}`,
          source: graph.nodes[i].nodeId,
          target: graph.nodes[j].nodeId,
          transitionType: "causal-distant",
          weight: 0.6,
        });
        break;
      }
    }
  }

  return graph;
}
