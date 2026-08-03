/**
 * Banc de mesure de la stabilité d'extraction.
 *
 * MOTIF. Le retour des bêta-testeurs formule une objection théorique : la
 * définition du vol d'intrigue porte sur « LA structure narrative profonde »,
 * au singulier, alors que l'outil, en repassant par un modèle de langage à
 * chaque exécution, produit en fait un NUAGE de structures possibles. Une œuvre
 * comparée à elle-même y perdait des nœuds, et la détection de condensation par
 * inclusion de sous-graphe échouait faute de coordonnées concordantes.
 *
 * L'objection est juste. Elle est aussi, jusqu'ici, restée invérifiable : rien
 * dans le moteur ne mesurait l'ampleur du nuage. Toute retouche du prompt se
 * jugeait à l'impression. Ce module fournit les chiffres, et rien d'autre : il
 * ne corrige pas la variance, il la constate.
 *
 * CE QUI EST MESURÉ. Quatre indicateurs, du plus grossier au plus exigeant :
 *
 * 1. `nodeCountCv` — coefficient de variation du nombre de nœuds. C'est la
 *    mesure que les testeurs ont observée à l'œil nu (« 35 puis 33 », « 25 puis
 *    29 »). Elle ne dit rien de la nature des nœuds : deux passes peuvent
 *    produire 30 nœuds chacune sans rien avoir en commun.
 * 2. `functionJaccard` — accord sur le RÉPERTOIRE mobilisé, en multiensemble
 *    (une passe qui voit trois F20 et une autre un seul ne sont d'accord qu'au
 *    tiers sur cette fonction).
 * 3. `positionalAgreement` — accord sur le couple (fonction, position relative),
 *    reprise de la clé historique de `consensus.ts`. Une œuvre stable garde ses
 *    fonctions AUX MÊMES ENDROITS du récit.
 * 4. `anchorIou` — recouvrement textuel réel des nœuds appariés, via les
 *    coordonnées de caractères issues du découpage en blocs. C'est le seul
 *    indicateur qui répond vraiment à l'objection des testeurs : il dit si deux
 *    passes découpent le récit aux mêmes endroits. Il vaut `null` sur des
 *    analyses non ancrées.
 *
 * Aucun de ces indicateurs n'est un score de qualité. Ils mesurent la
 * REPRODUCTIBILITÉ d'une extraction, pas sa justesse.
 */
import type { LlmAnalysis, LlmNode } from "./llm-schema";
import { maxWeightAssignment } from "../comparison/assignment";

/** Granularité de l'alignement positionnel — identique à `consensus.ts`. */
const POSITION_BUCKETS = 8;

export interface PairStability {
  /** Indices des deux passes comparées. */
  a: number;
  b: number;
  functionJaccard: number;
  positionalAgreement: number;
  /** `null` si l'une des deux passes n'est pas ancrée. */
  anchorIou: number | null;
}

export interface StabilityReport {
  passes: number;
  nodeCounts: number[];
  nodeCountMean: number;
  nodeCountSd: number;
  /** Écart-type rapporté à la moyenne : comparable d'une œuvre à l'autre. */
  nodeCountCv: number;
  /** Accord moyen sur le multiensemble des fonctions, sur toutes les paires. */
  functionJaccard: number;
  /** Accord moyen sur le couple (fonction, position relative). */
  positionalAgreement: number;
  /** Recouvrement textuel moyen des nœuds appariés ; `null` sans ancrage. */
  anchorIou: number | null;
  /** Part des nœuds portant des coordonnées textuelles, toutes passes confondues. */
  anchoredRatio: number;
  pairwise: PairStability[];
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

/** Multiensemble des codes de fonction d'une passe. */
function functionMultiset(analysis: LlmAnalysis): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of analysis.nodes) {
    const code = node.function_code || "—";
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

/**
 * Jaccard de multiensembles : intersection = somme des minima, union = somme des
 * maxima. Vaut 1 si les deux passes mobilisent exactement les mêmes fonctions
 * dans les mêmes proportions, et pénalise les écarts de comptage — qu'un Jaccard
 * ensembliste ordinaire ignorerait.
 */
export function multisetJaccard(a: Map<string, number>, b: Map<string, number>): number {
  const keys = new Set([...a.keys(), ...b.keys()]);
  if (keys.size === 0) return 1;
  let intersection = 0;
  let union = 0;
  for (const key of keys) {
    const ca = a.get(key) ?? 0;
    const cb = b.get(key) ?? 0;
    intersection += Math.min(ca, cb);
    union += Math.max(ca, cb);
  }
  return union > 0 ? intersection / union : 1;
}

/** Clé (fonction, position relative bucketisée) — reprise de `consensus.ts`. */
function positionalKey(node: LlmNode, index: number, total: number): string {
  const position = total > 1 ? index / (total - 1) : 0;
  return `${node.function_code}@${Math.round(position * POSITION_BUCKETS)}`;
}

/**
 * Part des clés positionnelles communes aux deux passes, rapportée à la passe la
 * plus fournie. Symétrique, et borné par 1.
 */
export function positionalAgreement(a: LlmAnalysis, b: LlmAnalysis): number {
  if (a.nodes.length === 0 && b.nodes.length === 0) return 1;
  if (a.nodes.length === 0 || b.nodes.length === 0) return 0;

  const keysB = new Map<string, number>();
  b.nodes.forEach((node, i) => {
    const key = positionalKey(node, i, b.nodes.length);
    keysB.set(key, (keysB.get(key) ?? 0) + 1);
  });

  let shared = 0;
  a.nodes.forEach((node, i) => {
    const key = positionalKey(node, i, a.nodes.length);
    const remaining = keysB.get(key) ?? 0;
    if (remaining > 0) {
      shared++;
      keysB.set(key, remaining - 1);
    }
  });

  return shared / Math.max(a.nodes.length, b.nodes.length);
}

interface Span {
  start: number;
  end: number;
}

/** Plage de caractères d'un nœud ancré, ou `null`. */
function nodeSpan(node: LlmNode): Span | null {
  if (node._char_start === undefined || node._char_end === undefined) return null;
  if (node._char_end <= node._char_start) return null;
  return { start: node._char_start, end: node._char_end };
}

/** Intersection sur union de deux plages de caractères. */
export function spanIou(a: Span, b: Span): number {
  const intersection = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  if (intersection === 0) return 0;
  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return union > 0 ? intersection / union : 0;
}

/**
 * Recouvrement textuel moyen entre deux passes ancrées.
 *
 * Les nœuds sont appariés PAR RECOUVREMENT MAXIMAL — appariement optimal
 * (hongrois), non glouton : sur deux passes voisines, un glouton laisserait des
 * nœuds sans partenaire alors qu'un autre appariement les explique, et
 * sous-estimerait la stabilité. Le résultat est rapporté au nombre de nœuds de
 * la passe la plus fournie : un nœud sans partenaire compte comme un
 * recouvrement nul, et non comme une absence de mesure.
 *
 * Retourne `null` si l'une des passes ne porte aucune coordonnée.
 */
export function anchorIou(a: LlmAnalysis, b: LlmAnalysis): number | null {
  const spansA = a.nodes.map(nodeSpan);
  const spansB = b.nodes.map(nodeSpan);
  const usableA = spansA.filter((s): s is Span => s !== null);
  const usableB = spansB.filter((s): s is Span => s !== null);
  if (usableA.length === 0 || usableB.length === 0) return null;

  const gain: number[][] = usableA.map((sa) => usableB.map((sb) => spanIou(sa, sb)));
  const assignment = maxWeightAssignment(gain);

  let total = 0;
  for (let i = 0; i < assignment.length; i++) {
    const j = assignment[i];
    if (j >= 0) total += gain[i][j];
  }
  return total / Math.max(usableA.length, usableB.length);
}

/**
 * Mesure la stabilité d'un jeu de k extractions du MÊME texte.
 *
 * Toutes les paires sont comparées (k(k−1)/2), puis moyennées : une seule paire
 * pourrait être fortuitement concordante. Avec une seule passe, le rapport est
 * dégénéré — variance nulle et accords à 1 — ce qui doit être lu comme « non
 * mesuré », jamais comme « parfaitement stable ».
 */
export function measureStability(passes: LlmAnalysis[]): StabilityReport {
  if (passes.length === 0) throw new Error("measureStability : aucune passe fournie.");

  const nodeCounts = passes.map((p) => p.nodes.length);
  const nodeCountMean = mean(nodeCounts);
  const nodeCountSd = standardDeviation(nodeCounts);
  const totalNodes = nodeCounts.reduce((s, v) => s + v, 0);
  const anchoredNodes = passes.reduce(
    (s, p) => s + p.nodes.filter((n) => nodeSpan(n) !== null).length,
    0,
  );

  const pairwise: PairStability[] = [];
  for (let i = 0; i < passes.length; i++) {
    for (let j = i + 1; j < passes.length; j++) {
      pairwise.push({
        a: i,
        b: j,
        functionJaccard: multisetJaccard(functionMultiset(passes[i]), functionMultiset(passes[j])),
        positionalAgreement: positionalAgreement(passes[i], passes[j]),
        anchorIou: anchorIou(passes[i], passes[j]),
      });
    }
  }

  const anchorValues = pairwise
    .map((p) => p.anchorIou)
    .filter((v): v is number => v !== null);

  return {
    passes: passes.length,
    nodeCounts,
    nodeCountMean,
    nodeCountSd,
    nodeCountCv: nodeCountMean > 0 ? nodeCountSd / nodeCountMean : 0,
    functionJaccard: pairwise.length > 0 ? mean(pairwise.map((p) => p.functionJaccard)) : 1,
    positionalAgreement: pairwise.length > 0 ? mean(pairwise.map((p) => p.positionalAgreement)) : 1,
    anchorIou: anchorValues.length > 0 ? mean(anchorValues) : null,
    anchoredRatio: totalNodes > 0 ? anchoredNodes / totalNodes : 0,
    pairwise,
  };
}

/**
 * Seuils de lecture du rapport. Ils ne sont pas des exigences du moteur mais des
 * repères communs, pour que « c'est mieux » cesse d'être une appréciation.
 *
 * `nodeCountCv` ≤ 0,05 signifie qu'un graphe de 30 nœuds varie de moins de 1,5
 * nœud d'une exécution à l'autre — en deçà, la comparaison de deux œuvres n'est
 * plus dominée par le bruit d'extraction.
 */
export const STABILITY_TARGETS = {
  nodeCountCv: 0.05,
  functionJaccard: 0.85,
  positionalAgreement: 0.8,
  anchorIou: 0.7,
} as const;

export type StabilityGrade = "stable" | "acceptable" | "instable";

/**
 * Verdict d'ensemble. Un indicateur non mesuré (`anchorIou` sans ancrage) est
 * ignoré plutôt que compté comme réussi : une mesure absente n'est pas une
 * bonne nouvelle.
 */
export function gradeStability(report: StabilityReport): StabilityGrade {
  if (report.passes < 2) return "instable"; // non mesuré : on ne présume rien
  const checks: boolean[] = [
    report.nodeCountCv <= STABILITY_TARGETS.nodeCountCv,
    report.functionJaccard >= STABILITY_TARGETS.functionJaccard,
    report.positionalAgreement >= STABILITY_TARGETS.positionalAgreement,
  ];
  if (report.anchorIou !== null) checks.push(report.anchorIou >= STABILITY_TARGETS.anchorIou);

  const passed = checks.filter(Boolean).length;
  if (passed === checks.length) return "stable";
  if (passed >= checks.length - 1) return "acceptable";
  return "instable";
}

/** Rendu texte du rapport, pour le harnais en ligne de commande et les journaux. */
export function formatStabilityReport(report: StabilityReport, label = ""): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
  const lines = [
    `── Stabilité d'extraction${label ? ` — ${label}` : ""} ──`,
    `Passes                : ${report.passes}`,
    `Nœuds par passe       : ${report.nodeCounts.join(", ")}`,
    `Moyenne / écart-type  : ${report.nodeCountMean.toFixed(2)} / ${report.nodeCountSd.toFixed(2)}`,
    `Coeff. de variation   : ${pct(report.nodeCountCv)}  (cible ≤ ${pct(STABILITY_TARGETS.nodeCountCv)})`,
    `Accord fonctions      : ${pct(report.functionJaccard)}  (cible ≥ ${pct(STABILITY_TARGETS.functionJaccard)})`,
    `Accord positionnel    : ${pct(report.positionalAgreement)}  (cible ≥ ${pct(STABILITY_TARGETS.positionalAgreement)})`,
    report.anchorIou !== null
      ? `Recouvrement ancres   : ${pct(report.anchorIou)}  (cible ≥ ${pct(STABILITY_TARGETS.anchorIou)})`
      : `Recouvrement ancres   : non mesuré (aucun nœud ancré)`,
    `Nœuds ancrés          : ${pct(report.anchoredRatio)}`,
    `Verdict               : ${gradeStability(report).toUpperCase()}`,
  ];
  return lines.join("\n");
}
