/**
 * Module 3 — Analyse comparative. Produit SNS, SS, ST, SRJ + modalité.
 *
 * Portage initial de `narria/m3_comparison/comparator.py`, révisé le 28/07/2026
 * pour appliquer les correctifs P0/P1/P2 de la note interne du 27/07/2026
 * (déficit de pouvoir discriminant du score composite). Les écarts assumés au
 * moteur Python sont signalés au fil du code par un renvoi au correctif.
 */
import type {
  NarrativeGraph,
  NarrativeNode,
  ComparisonResult,
  Correspondence,
  CoverageReport,
  GenreVerdict,
  AlertVerdict,
  Modalities,
  SrjLevel,
} from "../models";
import { functionSequence, tensionProfile } from "../models";
import { DEFAULT_FUNCTION_IDF, nodeSpecificityWeight, type FunctionIdf } from "./function-idf";
import {
  CONTENT_MATCH_THRESHOLD,
  contentSimilarity as defaultContentSimilarity,
  canonicalizeActant,
  type ContentSimilarityFn,
} from "./content-similarity";
import { compareGenres, genreKey, type GenreComparison } from "./genre";
import { evaluateAgainstBaseline, BASELINE_ALERT_Z } from "./baseline";

/**
 * Profils de pondération du composite.
 *
 * `v1` reproduit les poids d'origine. `v2-stabilized` rééquilibre en faveur de
 * S_ACT et au détriment de S_TENS (anomalie A2 : la courbe exposition-montée-
 * climax-résolution est commune à presque tout récit et ne mesure pas
 * l'emprunt). Le point 10 de la note interdit explicitement d'appliquer cette
 * repondération AVANT que l'extraction ne soit stabilisée (point 9), sous peine
 * d'amplifier le bruit de S_ACT : `v1` reste donc le profil par défaut, et
 * `v2-stabilized` s'active par `compare(..., { weights: "v2-stabilized" })` une
 * fois la variance inter-exécutions mesurée et en baisse.
 */
export const SNS_WEIGHT_PROFILES = {
  v1: { iso: 0.25, ged: 0.2, func: 0.25, act: 0.15, tens: 0.15 },
  "v2-stabilized": { iso: 0.3, ged: 0.2, func: 0.25, act: 0.18, tens: 0.07 },
} as const;

export type SnsWeightProfile = keyof typeof SNS_WEIGHT_PROFILES;

export interface CompareOptions {
  /** Profil de pondération du composite. Défaut : `v1` (cf. point 10 de la note). */
  weights?: SnsWeightProfile;
  /** Mesure de similarité de contenu ; permet d'injecter des embeddings (cf. P1-5). */
  contentSimilarity?: ContentSimilarityFn;
  /** Table de spécificité des fonctions ; permet d'injecter des fréquences de corpus (cf. P1-4). */
  functionIdf?: FunctionIdf;
}

type Meta = Record<string, unknown>;
function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function modalitySimilarity(m1: Modalities, m2: Modalities): number {
  const keys: (keyof Modalities)[] = ["vouloir", "devoir", "pouvoir", "savoir"];
  const dot = keys.reduce((s, k) => s + (m1[k] ?? 0) * (m2[k] ?? 0), 0);
  const n1 = Math.sqrt(keys.reduce((s, k) => s + m1[k] * m1[k], 0));
  const n2 = Math.sqrt(keys.reduce((s, k) => s + m2[k] * m2[k], 0));
  if (n1 === 0 || n2 === 0) return 0;
  return dot / (n1 * n2);
}

function nodeSimilarity(n1: NarrativeNode, n2: NarrativeNode): number {
  let score = 0;
  let functionMatch = false;
  let familyMatch = false;

  if (n1.functionCode && n2.functionCode) {
    if (n1.functionCode === n2.functionCode) {
      score += 0.6;
      functionMatch = true;
    } else if (n1.functionFamily && n2.functionFamily && n1.functionFamily === n2.functionFamily) {
      score += 0.15;
      familyMatch = true;
    }
  }

  if (!functionMatch && !familyMatch) {
    if (n1.phase && n2.phase && n1.phase === n2.phase) score += 0.1;
    if (Math.abs(n1.tension - n2.tension) < 0.15) score += 0.05;
    return score;
  }

  if (n1.actants.length && n2.actants.length) {
    // Normalisation canonique des actants (P2-9) : « Roméo (sujet) » et « roméo »
    // désignaient jusqu'ici deux entités distinctes, ce qui rendait S_ACT et
    // l'appariement sensibles à la formulation retenue par le LLM d'une exécution
    // à l'autre.
    const set1 = new Set(n1.actants.map(canonicalizeActant).filter(Boolean));
    const set2 = new Set(n2.actants.map(canonicalizeActant).filter(Boolean));
    if (set1.size && set2.size) {
      let inter = 0;
      for (const a of set1) if (set2.has(a)) inter += 1;
      const union = new Set([...set1, ...set2]).size;
      const jaccard = union > 0 ? inter / union : 0;
      score += 0.2 * jaccard;
    }
  }

  if (n1.phase && n2.phase && n1.phase === n2.phase) score += 0.1;
  if (Math.abs(n1.tension - n2.tension) < 0.15) score += 0.05;
  if (n1.modalities && n2.modalities) score += 0.05 * modalitySimilarity(n1.modalities, n2.modalities);

  return score;
}

const MATCH_THRESHOLD = 0.4;

function functionOccurrences(g: NarrativeGraph): Map<string, number> {
  const counts = new Map<string, number>();
  for (const n of g.nodes) {
    if (n.functionCode) counts.set(n.functionCode, (counts.get(n.functionCode) ?? 0) + 1);
  }
  return counts;
}

interface IsomorphismOutcome {
  score: number;
  correspondences: Correspondence[];
  coverage: CoverageReport;
}

/**
 * Isomorphisme de sous-graphes, révisé par trois correctifs cumulés :
 *
 * - P1-4 — chaque nœud est pondéré par la spécificité de sa fonction (IDF
 *   fonctionnel) : un appariement sur FNMALA pèse ~10× un appariement sur F13.
 * - P1-5 — un appariement exige, en plus de l'étiquette, un recouvrement
 *   minimal de contenu (extrait cité et actants).
 * - P1-6 — l'appariement devient injectif (un nœud de référence ne peut plus
 *   satisfaire plusieurs nœuds candidats), et le dénominateur porte sur les DEUX
 *   graphes : les nœuds orphelins pénalisent désormais le score au lieu d'être
 *   ignorés. Le score devient un Dice pondéré, symétrique.
 */
function scoreIsomorphism(
  gRef: NarrativeGraph,
  gCand: NarrativeGraph,
  idf: FunctionIdf,
  contentSimilarity: ContentSimilarityFn,
): IsomorphismOutcome {
  const emptyCoverage: CoverageReport = {
    refNodes: gRef.nodes.length,
    candNodes: gCand.nodes.length,
    refMatched: 0,
    candMatched: 0,
    refOrphans: gRef.nodes.length,
    candOrphans: gCand.nodes.length,
    ratio: 0,
  };
  if (!gRef.nodes.length || !gCand.nodes.length) {
    return { score: 0, correspondences: [], coverage: emptyCoverage };
  }

  const occRef = functionOccurrences(gRef);
  const occCand = functionOccurrences(gCand);
  const weightRef = (n: NarrativeNode) =>
    nodeSpecificityWeight(n.functionCode, occRef.get(n.functionCode ?? "") ?? 1, idf);
  const weightCand = (n: NarrativeNode) =>
    nodeSpecificityWeight(n.functionCode, occCand.get(n.functionCode ?? "") ?? 1, idf);

  // 1. Candidats d'appariement : étiquette + structure locale ET contenu.
  type Candidate = {
    ref: NarrativeNode;
    cand: NarrativeNode;
    similarity: number;
    content: number;
  };
  const candidates: Candidate[] = [];
  for (const cNode of gCand.nodes) {
    for (const rNode of gRef.nodes) {
      const similarity = nodeSimilarity(rNode, cNode);
      if (similarity < MATCH_THRESHOLD) continue;
      const content = contentSimilarity(rNode, cNode);
      if (content < CONTENT_MATCH_THRESHOLD) continue;
      candidates.push({ ref: rNode, cand: cNode, similarity, content });
    }
  }

  // 2. Appariement injectif glouton : les meilleures paires d'abord, chaque nœud
  //    ne servant qu'une fois. Les nœuds restants sont des orphelins comptabilisés.
  candidates.sort((a, b) =>
    b.similarity - a.similarity || b.content - a.content || a.cand.nodeId.localeCompare(b.cand.nodeId),
  );
  const usedRef = new Set<string>();
  const usedCand = new Set<string>();
  const correspondences: Correspondence[] = [];
  let matchedWeight = 0;

  for (const c of candidates) {
    if (usedRef.has(c.ref.nodeId) || usedCand.has(c.cand.nodeId)) continue;
    usedRef.add(c.ref.nodeId);
    usedCand.add(c.cand.nodeId);
    const wRef = weightRef(c.ref);
    const wCand = weightCand(c.cand);
    matchedWeight += wRef + wCand;
    correspondences.push({
      candNode: c.cand.nodeId,
      candFunction: c.cand.functionCode || "—",
      refNode: c.ref.nodeId,
      refFunction: c.ref.functionCode || "—",
      similarity: c.similarity,
      refExcerpt: c.ref.textExcerpt ?? "",
      candExcerpt: c.cand.textExcerpt ?? "",
      refActants: c.ref.actants ?? [],
      candActants: c.cand.actants ?? [],
      contentSimilarity: c.content,
      specificity: (wRef + wCand) / 2,
    });
  }

  const totalWeight =
    gRef.nodes.reduce((s, n) => s + weightRef(n), 0) + gCand.nodes.reduce((s, n) => s + weightCand(n), 0);
  const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  const coverage: CoverageReport = {
    refNodes: gRef.nodes.length,
    candNodes: gCand.nodes.length,
    refMatched: usedRef.size,
    candMatched: usedCand.size,
    refOrphans: gRef.nodes.length - usedRef.size,
    candOrphans: gCand.nodes.length - usedCand.size,
    ratio: (usedRef.size + usedCand.size) / (gRef.nodes.length + gCand.nodes.length),
  };

  correspondences.sort((a, b) => b.similarity - a.similarity);
  return { score, correspondences, coverage };
}

/**
 * GED narrative, révisée par deux correctifs :
 *
 * - P1-4 — le Jaccard des ensembles de fonctions est pondéré par la spécificité :
 *   partager F13 et F20 ne vaut pas partager FNANC et F55.
 * - P1-6 — la pénalité de taille brute est remplacée par une pénalité de
 *   couverture réelle : ce n'est pas l'écart de taille qui compte, c'est la
 *   proportion de nœuds qu'aucun appariement ne parvient à expliquer.
 */
function scoreGed(
  gRef: NarrativeGraph,
  gCand: NarrativeGraph,
  coverage: CoverageReport,
  idf: FunctionIdf,
): number {
  if (!gRef.nodes.length || !gCand.nodes.length) return 0;
  const funcsRef = new Set(gRef.nodes.filter((n) => n.functionCode).map((n) => n.functionCode!));
  const funcsCand = new Set(gCand.nodes.filter((n) => n.functionCode).map((n) => n.functionCode!));
  if (!funcsRef.size && !funcsCand.size) return 0.5;
  if (!funcsRef.size || !funcsCand.size) return 0;

  let interWeight = 0;
  let unionWeight = 0;
  for (const f of new Set([...funcsRef, ...funcsCand])) {
    const w = idf.weight(f);
    unionWeight += w;
    if (funcsRef.has(f) && funcsCand.has(f)) interWeight += w;
  }
  const weightedJaccard = unionWeight > 0 ? interWeight / unionWeight : 0;
  const coveragePenalty = 1 - 0.3 * (1 - coverage.ratio);
  return Math.max(0, weightedJaccard * coveragePenalty);
}

/**
 * Similarité des séquences de fonctions (LCS), révisée par le correctif P1-4
 * (anomalie A1 — le point 4 vise « chaque appariement », et la LCS en est un).
 *
 * Trois écarts au moteur d'origine :
 *
 * 1. Les fonctions FN* ne sont plus exclues. Le point 4 cite précisément FNMALA
 *    comme devant peser davantage qu'un F20 : les écarter de la séquence
 *    comparée revenait à jeter le signal le plus discriminant du répertoire.
 * 2. Le recouvrement devient un Dice symétrique, `2·LCS / (W_ref + W_cand)`.
 *    L'ancien `LCS / min(m, n)` saturait dès que la séquence courte était
 *    incluse dans la longue — situation ordinaire entre deux récits d'action —
 *    et le facteur de longueur qui compensait ce biais devient inutile.
 * 3. Le résultat est modulé par la spécificité ABSOLUE des fonctions alignées.
 *    C'est le cœur de A1 : une normalisation par les poids seule s'annule au
 *    numérateur et au dénominateur, si bien que deux récits alignés sur six
 *    fonctions banales obtenaient encore 0,87. Le facteur mesure ce que
 *    l'alignement vaut, et non seulement sa proportion.
 */
function scoreFunctionSequence(gRef: NarrativeGraph, gCand: NarrativeGraph, idf: FunctionIdf): number {
  const seqRef = functionSequence(gRef);
  const seqCand = functionSequence(gCand);
  if (!seqRef.length || !seqCand.length) return 0;

  const m = seqRef.length;
  const n = seqCand.length;
  // dp[i][j] = [poids cumulé de la LCS, nombre de fonctions alignées]
  const dpWeight: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const dpCount: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seqRef[i - 1] === seqCand[j - 1]) {
        dpWeight[i][j] = dpWeight[i - 1][j - 1] + idf.weight(seqRef[i - 1]);
        dpCount[i][j] = dpCount[i - 1][j - 1] + 1;
      } else if (dpWeight[i - 1][j] >= dpWeight[i][j - 1]) {
        dpWeight[i][j] = dpWeight[i - 1][j];
        dpCount[i][j] = dpCount[i - 1][j];
      } else {
        dpWeight[i][j] = dpWeight[i][j - 1];
        dpCount[i][j] = dpCount[i][j - 1];
      }
    }
  }
  const lcsWeight = dpWeight[m][n];
  const lcsCount = dpCount[m][n];
  if (lcsCount === 0) return 0;

  const weightRef = seqRef.reduce((s, c) => s + idf.weight(c), 0);
  const weightCand = seqCand.reduce((s, c) => s + idf.weight(c), 0);
  const total = weightRef + weightCand;
  const dice = total > 0 ? Math.min(1, (2 * lcsWeight) / total) : 0;

  // Spécificité moyenne des fonctions alignées, rapportée à la fréquence pivot
  // (poids 1). Plafonnée : aligner des fonctions rares ne peut pas faire dépasser
  // le recouvrement réellement observé.
  const specificity = Math.min(1, lcsWeight / lcsCount);
  return dice * specificity;
}

function scoreActantialPersistence(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  if (!gRef.nodes.length || !gCand.nodes.length) return 0;
  const countActants = (g: NarrativeGraph) => {
    const m = new Map<string, number>();
    // Forme canonique (P2-9) : sans elle, « Roméo » et « Roméo (sujet) » comptent
    // pour deux actants distincts d'une exécution à l'autre.
    for (const node of g.nodes) {
      for (const a of node.actants) {
        const key = canonicalizeActant(a);
        if (key) m.set(key, (m.get(key) ?? 0) + 1);
      }
    }
    return m;
  };
  const aRef = countActants(gRef);
  const aCand = countActants(gCand);
  if (!aRef.size || !aCand.size) return 0;
  const topRef = [...aRef.values()].sort((x, y) => y - x);
  const topCand = [...aCand.values()].sort((x, y) => y - x);
  const k = Math.min(3, topRef.length, topCand.length);
  if (k === 0) return 0;
  const sumRef = topRef.slice(0, k).reduce((s, v) => s + v, 0);
  const sumCand = topCand.slice(0, k).reduce((s, v) => s + v, 0);
  if (Math.max(sumRef, sumCand) === 0) return 0;
  return Math.min(sumRef, sumCand) / Math.max(sumRef, sumCand);
}

const GREIMAS_POSITIONS = ["protagoniste", "objet", "destinateur", "destinataire", "adjuvant", "opposant"];
const GREIMAS_STOPWORDS = new Set(["les", "des", "que", "qui", "son", "sont", "pour",
  "avec", "dans", "par", "sur", "cette", "ces", "ses", "leur", "leurs", "tout", "tous", "aucun", "aucune"]);

function compareActantConfigs(a: Record<string, unknown>, b: Record<string, unknown>): number {
  if (!Object.keys(a).length || !Object.keys(b).length) return 0;
  const scores: number[] = [];
  for (const pos of GREIMAS_POSITIONS) {
    const valA = asStr(a[pos]).trim().toLowerCase();
    const valB = asStr(b[pos]).trim().toLowerCase();
    if (!valA || !valB) {
      if (!valA && !valB) scores.push(0.5);
      continue;
    }
    const wordsA = new Set((valA.match(/[a-zàâäéèêëïîôöùûüç]{3,}/g) ?? []).filter((w) => !GREIMAS_STOPWORDS.has(w)));
    const wordsB = new Set((valB.match(/[a-zàâäéèêëïîôöùûüç]{3,}/g) ?? []).filter((w) => !GREIMAS_STOPWORDS.has(w)));
    if (!wordsA.size || !wordsB.size) continue;
    let inter = 0;
    for (const w of wordsA) if (wordsB.has(w)) inter += 1;
    const union = new Set([...wordsA, ...wordsB]).size;
    scores.push(union > 0 ? inter / union : 0);
  }
  if (!scores.length) return 0;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function scoreGreimasAlignment(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  const mRef = asObj(gRef.metadata);
  const mCand = asObj(gCand.metadata);
  const refV1 = asObj(mRef.main_actants_v1 ?? mRef.main_actants);
  const refV2 = asObj(mRef.main_actants_v2 ?? mRef.main_actants);
  const candV1 = asObj(mCand.main_actants_v1 ?? mCand.main_actants);
  const candV2 = asObj(mCand.main_actants_v2 ?? mCand.main_actants);
  const hasRef = Object.keys(refV1).length || Object.keys(refV2).length;
  const hasCand = Object.keys(candV1).length || Object.keys(candV2).length;
  if (!hasRef || !hasCand) return 0.5;
  const combos: [Record<string, unknown>, Record<string, unknown>][] = [
    [refV1, candV1], [refV1, candV2], [refV2, candV1], [refV2, candV2],
  ];
  let best = 0;
  for (const [rc, cc] of combos) best = Math.max(best, compareActantConfigs(rc, cc));
  return best;
}

function scoreActantialChain(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  const chain = scoreActantialPersistence(gRef, gCand);
  const greimas = scoreGreimasAlignment(gRef, gCand);
  return (chain + greimas) / 2;
}

function resample(seq: number[], targetLen: number): number[] {
  if (seq.length === targetLen) return [...seq];
  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const srcPos = targetLen > 1 ? (i * (seq.length - 1)) / (targetLen - 1) : 0;
    const lo = Math.floor(srcPos);
    const hi = Math.min(lo + 1, seq.length - 1);
    const frac = srcPos - lo;
    result.push(seq[lo] * (1 - frac) + seq[hi] * frac);
  }
  return result;
}

/**
 * Arc dramatique canonique (courbe de Freytag) : montée progressive jusqu'au
 * climax situé aux quatre cinquièmes du récit, puis chute vers la résolution.
 * Sert de patron générique à retirer avant corrélation.
 */
function genericArc(length: number): number[] {
  const CLIMAX = 0.8;
  return Array.from({ length }, (_, i) => {
    const p = length > 1 ? i / (length - 1) : 0;
    return p < CLIMAX ? 0.15 + (p / CLIMAX) * 0.8 : 0.95 - ((p - CLIMAX) / (1 - CLIMAX)) * 0.6;
  });
}

/** Centre-réduit une série ; retourne `null` si elle est constante (variance nulle). */
function standardize(values: number[]): number[] | null {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  if (sd === 0) return null;
  return values.map((v) => (v - mean) / sd);
}

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  for (let i = 0; i < n; i++) num += (a[i] - meanA) * (b[i] - meanB);
  const denA = Math.sqrt(a.reduce((s, v) => s + (v - meanA) ** 2, 0));
  const denB = Math.sqrt(b.reduce((s, v) => s + (v - meanB) ** 2, 0));
  if (denA === 0 || denB === 0) return null;
  return num / (denA * denB);
}

/**
 * Corrélation des signatures tensives, mesurée sur l'écart au patron générique
 * (correctif de l'anomalie A2).
 *
 * La courbe exposition → montée → climax → résolution est commune à la
 * quasi-totalité des récits d'apprentissage et d'action : la corréler revenait à
 * constater que les deux textes sont des récits, ce qui donnait 0,900 sur une
 * paire dérivée mais aussi 0,664 sur une paire sans aucun lien. On retire donc
 * l'arc canonique des deux profils centrés-réduits et on corrèle les RÉSIDUS —
 * c'est-à-dire ce que chaque récit fait de singulier avec sa tension, seul
 * élément susceptible de trahir un emprunt.
 *
 * Note : il s'agit d'une correction de la MESURE, non d'une repondération du
 * composite — le point 10 de la note interdit la seconde avant stabilisation de
 * l'extraction, pas la première.
 */
function scoreTensionProfile(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  const sigRef = tensionProfile(gRef);
  const sigCand = tensionProfile(gCand);
  if (!sigRef.length || !sigCand.length) return 0;
  const targetLen = Math.min(sigRef.length, sigCand.length, 20);
  if (targetLen < 3) return 0.5;

  const zA = standardize(resample(sigRef, targetLen));
  const zB = standardize(resample(sigCand, targetLen));
  const zArc = standardize(genericArc(targetLen));
  // Profil plat : aucune dynamique tensive à comparer.
  if (!zA || !zB || !zArc) return 0.5;

  const residualA = zA.map((v, i) => v - zArc[i]);
  const residualB = zB.map((v, i) => v - zArc[i]);
  const r = pearson(residualA, residualB);
  // Résidu nul : le profil épouse exactement l'arc générique. Le récit n'a donc
  // aucune singularité tensive, et rien de spécifique ne peut être rapproché.
  if (r === null) return 0.5;
  return (r + 1) / 2;
}

// ── Score de Transformation (5 dimensions) ──────────────────────────────
function deltaFormal(ffRef: Meta, ffCand: Meta): number {
  const formRef = asStr(ffRef.form).toLowerCase();
  const formCand = asStr(ffCand.form).toLowerCase();
  const deltaForm = formRef === formCand ? 0 : 1;
  const cats: Record<string, number> = { tres_court: 1, court: 2, moyen: 3, long: 4, tres_long: 5 };
  const catRef = cats[asStr(ffRef.narrative_length_category || "moyen").toLowerCase()] ?? 3;
  const catCand = cats[asStr(ffCand.narrative_length_category || "moyen").toLowerCase()] ?? 3;
  const deltaLength = Math.abs(catRef - catCand) / 4;
  return (deltaForm + deltaLength) / 2;
}

function deltaRegister(ffRef: Meta, ffCand: Meta): number {
  const regRef = asStr(ffRef.register).toLowerCase();
  const regCand = asStr(ffCand.register).toLowerCase();
  if (!regRef || !regCand) return 0.5;
  if (regRef === regCand) return 0;
  const prox: Record<string, number> = {
    "narratif_neutre|didactique": 0.3, "narratif_neutre|poetique": 0.7, "narratif_neutre|lyrique": 0.7,
    "narratif_neutre|dramatique": 0.6, "narratif_neutre|comique": 0.5, "narratif_neutre|satirique": 0.5,
    "narratif_neutre|epique": 0.6, "didactique|poetique": 0.6, "didactique|satirique": 0.4,
    "poetique|lyrique": 0.2, "poetique|epique": 0.4, "comique|satirique": 0.3,
  };
  return prox[`${regRef}|${regCand}`] ?? prox[`${regCand}|${regRef}`] ?? 0.7;
}

function deltaFocus(metaRef: Meta, metaCand: Meta): number {
  const refV1 = asObj(metaRef.main_actants_v1 ?? metaRef.main_actants);
  const candV1 = asObj(metaCand.main_actants_v1 ?? metaCand.main_actants);
  if (!Object.keys(refV1).length || !Object.keys(candV1).length) return 0.5;
  const protoRef = asStr(refV1.protagoniste).toLowerCase().trim();
  const protoCand = asStr(candV1.protagoniste).toLowerCase().trim();
  if (!protoRef || !protoCand) return 0.5;
  const wRef = new Set(protoRef.match(/[a-zàâäéèêëïîôöùûüç]{3,}/g) ?? []);
  const wCand = new Set(protoCand.match(/[a-zàâäéèêëïîôöùûüç]{3,}/g) ?? []);
  if (!wRef.size || !wCand.size) return 0.5;
  let inter = 0;
  for (const w of wRef) if (wCand.has(w)) inter += 1;
  const union = new Set([...wRef, ...wCand]).size;
  return 1 - (union > 0 ? inter / union : 0);
}

function deltaMoralLayer(ffRef: Meta, ffCand: Meta, gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  let moralRef = ffRef.has_explicit_morality as boolean | undefined;
  let moralCand = ffCand.has_explicit_morality as boolean | undefined;
  if (moralRef === undefined) moralRef = gRef.nodes.some((n) => n.functionCode === "F49");
  if (moralCand === undefined) moralCand = gCand.nodes.some((n) => n.functionCode === "F49");
  const narratorRef = ffRef.has_narrator_intervention as boolean | undefined;
  const narratorCand = ffCand.has_narrator_intervention as boolean | undefined;
  const deltaMoral = moralRef === moralCand ? 0 : 1;
  const deltaNarrator =
    narratorRef === undefined || narratorCand === undefined ? 0 : narratorRef === narratorCand ? 0 : 1;
  return (deltaMoral + deltaNarrator) / 2;
}

function scoreTransformation(gRef: NarrativeGraph, gCand: NarrativeGraph, sIso: number): number {
  const stStruct = 1 - sIso;
  const mRef = asObj(gRef.metadata);
  const mCand = asObj(gCand.metadata);
  const ffRef = asObj(mRef.formal_features);
  const ffCand = asObj(mCand.formal_features);
  const stForm = deltaFormal(ffRef, ffCand);
  const stRegister = deltaRegister(ffRef, ffCand);
  const stFocus = deltaFocus(mRef, mCand);
  const stMoral = deltaMoralLayer(ffRef, ffCand, gRef, gCand);
  const composite = (stStruct + stForm + stRegister + stFocus + stMoral) / 5;
  return Math.max(0, Math.min(1, composite));
}

function classifyModality(
  gRef: NarrativeGraph, gCand: NarrativeGraph,
  sIso: number, sFunc: number, sTens: number,
): string {
  const corroborated = sIso >= 0.45 && sFunc >= 0.35;
  if (!corroborated) {
    if (sIso < 0.25) return "Aucune modalité significative";
    return "Correspondance partielle non classifiée";
  }
  const lenRef = gRef.nodes.length;
  const lenCand = gCand.nodes.length;
  const sizeRatio = lenCand / Math.max(lenRef, 1);
  if (sizeRatio > 1.4 && sFunc > 0.45) return "Amplification";
  if (sizeRatio < 0.7 && sFunc > 0.45) return "Condensation";
  if (sTens < 0.3 && sIso > 0.45 && sFunc >= 0.35) return "Inversion (valences inversées)";
  if (sIso >= 0.55 && sFunc >= 0.45 && sizeRatio > 0.8 && sizeRatio < 1.3)
    return "Transposition (contextes différents)";
  if ((sIso >= 0.45 && sIso < 0.55) || (sFunc >= 0.35 && sFunc < 0.45)) return "Possible hybridation";
  return "Correspondance partielle non classifiée";
}

function evaluateSrj(sns: number, ss: number, modality: string): [number, SrjLevel] {
  const srj = 0.4 * sns + 0.4 * ss + 0.2 * (modality.includes("Aucune") ? 0 : 0.5);
  let level: SrjLevel;
  if (srj < 0.25) level = "Faible";
  else if (srj < 0.55) level = "Modéré";
  else if (srj < 0.8) level = "Élevé";
  else level = "Critique";
  return [srj, level];
}

/**
 * Verdict interprétatif. Correctif P0-2 (anomalie A4) : la formule « le score
 * dépasse ce qui est attendu d'une convergence indépendante DANS LE MÊME GENRE »
 * était affichée même lorsque les genres détectés différaient — un énoncé
 * factuellement faux. Elle n'apparaît désormais que si les genres coïncident ;
 * sinon un message inter-genres dédié est rendu.
 */
function buildVerdict(
  sns: number,
  ss: number,
  modality: string,
  genre: GenreVerdict,
  coverage: CoverageReport,
): string {
  // Mention systématique dès qu'elle s'applique : la divergence de genres porte
  // sur l'INTERPRÉTABILITÉ du score, non sur son intensité — elle vaut donc à
  // tous les niveaux de SNS.
  const crossGenreClause = genre.crossGenre
    ? ` Les genres détectés diffèrent au demeurant (« ${genre.refGenre} » vs « ${genre.candGenre} »), ce qui prive le score de toute référence d'interprétation.`
    : "";

  if (sns < 0.3)
    return `Les deux œuvres présentent des structures narratives substantiellement différentes. Le SNS est faible et ne suggère pas de correspondance structurale significative. Cela n'exclut pas un emprunt textuel de surface, qui serait détecté par un outil distinct.${crossGenreClause}`;

  // Le composite ne peut pas affirmer des « correspondances notables » quand
  // presque aucun nœud n'est apparié : un SNS élevé y provient de signaux
  // génériques — arc dramatique commun, fonctions banales — et non d'un rapport
  // entre les deux récits. Cette branche prévaut sur la valeur du SNS.
  const noModality = modality.includes("Aucune");
  if (noModality || coverage.ratio < ALERT_MIN_COVERAGE)
    return `Aucune correspondance structurale consistante n'a été établie entre les deux œuvres : seuls ${coverage.refMatched} des ${coverage.refNodes} nœuds de la référence et ${coverage.candMatched} des ${coverage.candNodes} nœuds du candidat ont trouvé un appariement vérifié par le contenu (couverture ${(coverage.ratio * 100).toFixed(0)} %). Le SNS de ${sns.toFixed(3)} provient de signaux communs à la quasi-totalité des récits — courbe dramatique en arc, fonctions narratives banales — et non d'un rapport établi entre ces deux textes.${crossGenreClause} Ce score ne doit pas être lu comme un indice d'emprunt.`;

  if (sns < 0.5)
    return `Les deux œuvres partagent certaines caractéristiques structurales. Cette similarité pourrait relever de conventions génériques communes plutôt que d'un emprunt spécifique (Score de Spécificité = ${ss.toFixed(2)}). Une analyse experte est recommandée pour vérifier si les correspondances relèvent de l'intertextualité légitime ou de l'emprunt non déclaré.${crossGenreClause}`;

  if (genre.crossGenre) {
    const situation = `Les genres détectés diffèrent (« ${genre.refGenre} » vs « ${genre.candGenre} »).`;
    if (sns < 0.7)
      return `Les deux œuvres présentent des correspondances structurales notables (modalité détectée : ${modality}). ${situation} Le score n'est donc PAS comparable à une référence de convergence intra-générique : aucune baseline n'existe pour une comparaison entre genres distincts, et l'interprétabilité de ce score est faible. Les correspondances relevées peuvent tenir à des schémas narratifs universels plutôt qu'à un lien entre les deux œuvres. Une lecture experte des correspondances elles-mêmes — et non du seul score — est indispensable avant toute conclusion.`;
    return `Les deux œuvres présentent des correspondances structurales fortes (modalité détectée : ${modality}). ${situation} En l'absence de baseline inter-genres, ce score ne peut être rapporté à une attente de convergence indépendante : il doit être vérifié correspondance par correspondance par un narratologue. Ce résultat ne constitue PAS une preuve de plagiat.`;
  }

  const genreClause =
    genre.sameGenre === true
      ? "dans le même genre"
      : "pour deux œuvres dont les genres n'ont pas pu être établis avec certitude";
  if (sns < 0.7)
    return `Les deux œuvres présentent des correspondances structurales notables (modalité détectée : ${modality}). Le score dépasse ce qui est attendu d'une convergence indépendante ${genreClause}. Il est fortement recommandé de consulter un narratologue et, le cas échéant, un juriste spécialisé en propriété intellectuelle avant toute conclusion.`;
  return `Les deux œuvres partagent une structure narrative profonde remarquablement similaire (modalité détectée : ${modality}). Cette similarité est difficilement explicable par la seule convergence indépendante. Une expertise narratologique et juridique approfondie est nécessaire. Ce résultat ne constitue PAS une preuve de plagiat : il est une indication à investiguer plus avant.`;
}

function buildWarnings(
  sns: number,
  gRef: NarrativeGraph,
  gCand: NarrativeGraph,
  genre: GenreVerdict,
  coverage: CoverageReport,
): string[] {
  const warnings: string[] = [];
  warnings.push(
    "Cette analyse est une aide à la décision — jamais un verdict. Aucun score, si élevé soit-il, ne constitue une preuve de plagiat. Les résultats de NARR'IA sont probabilistes et doivent toujours être soumis à l'appréciation d'une expertise humaine qualifiée (narratologue et, le cas échéant, juriste). NARR'IA n'établit pas le plagiat : il signale des correspondances structurales à investiguer.",
  );
  // P0-2 / P1-7 : avertissement renforcé sur la faible interprétabilité inter-genres.
  if (genre.crossGenre)
    warnings.push(
      `Comparaison inter-genres (« ${genre.refGenre} » vs « ${genre.candGenre} »). Les scores de NARR'IA sont calibrés sur des comparaisons intra-génériques : entre deux genres distincts, ils n'ont pas de référence d'interprétation et leur valeur absolue ne doit pas être lue comme un indice d'emprunt. La normalisation par genre (SNS_N) a été neutralisée pour cette comparaison.`,
    );
  else if (genre.sameGenre === null)
    warnings.push(
      "Le genre de l'une au moins des deux œuvres n'a pas pu être établi. Par prudence, la normalisation par genre (SNS_N) n'a pas été appliquée et le verdict évite toute affirmation relative à une convergence intra-générique.",
    );
  // P1-6 : la couverture rend visible ce que le score composite masquait.
  if (coverage.ratio < 0.35)
    warnings.push(
      `Couverture faible : seuls ${coverage.refMatched}/${coverage.refNodes} nœuds de la référence et ${coverage.candMatched}/${coverage.candNodes} nœuds du candidat ont trouvé un appariement de contenu (taux global ${(coverage.ratio * 100).toFixed(0)} %). L'essentiel des deux récits n'est expliqué par aucune correspondance : les scores portent sur une portion minoritaire des œuvres.`,
    );
  if (sns > 0.7)
    warnings.push(
      "Le score de similarité narrative globale est élevé. La prudence d'interprétation doit être d'autant plus grande : une similarité structurale forte peut résulter d'une filiation assumée, d'une convergence de genre, d'une source commune aux deux œuvres, ou d'un emprunt non déclaré — seule l'expertise humaine peut trancher entre ces hypothèses.",
    );
  if (gRef.nodes.length < 5 || gCand.nodes.length < 5)
    warnings.push(
      "L'un des deux textes est très court (moins de 5 nœuds narratifs identifiés). Les scores sont à interpréter avec une prudence accrue : un texte plus long permettrait une analyse plus fiable.",
    );
  const funcsRef = gRef.nodes.filter((n) => n.functionCode).length;
  const totalRef = gRef.nodes.length;
  if (totalRef > 0 && funcsRef / totalRef < 0.4)
    warnings.push(
      "Plus de 60 % des nœuds de l'œuvre de référence n'ont pas de fonction narrative identifiée. Les scores peuvent sous-estimer la similarité réelle.",
    );
  return warnings;
}

/** Seuil de SNS au-delà duquel une alerte est envisagée, à défaut de baseline calibrée. */
const ALERT_SNS_THRESHOLD = 0.55;
/** Couverture minimale exigée pour qu'une alerte ait un sens narratif (cf. A5). */
const ALERT_MIN_COVERAGE = 0.35;

/**
 * Décision d'alerte, explicitée (§5 de la note : « la paire B ne déclenche plus
 * aucune alerte »). Jusqu'ici l'alerte découlait mécaniquement du niveau SRJ,
 * lui-même dérivé d'un SNS non discriminant. Elle est désormais subordonnée à
 * trois conditions cumulatives : un écart significatif à la distribution nulle
 * du genre quand elle existe, une couverture d'appariement non marginale, et
 * l'exclusion des comparaisons inter-genres, non interprétables.
 */
function decideAlert(
  sns: number,
  modality: string,
  genre: GenreVerdict,
  coverage: CoverageReport,
  baseline: { zScore: number; corpusSize: number } | null,
): AlertVerdict {
  if (genre.crossGenre)
    return {
      triggered: false,
      reason:
        "Aucune alerte : les genres détectés diffèrent, et NARR'IA ne dispose d'aucune référence permettant d'interpréter un score inter-genres.",
    };
  if (coverage.ratio < ALERT_MIN_COVERAGE)
    return {
      triggered: false,
      reason: `Aucune alerte : couverture d'appariement trop faible (${(coverage.ratio * 100).toFixed(0)} %) pour qu'une correspondance structurale soit narrativement significative.`,
    };
  if (modality.includes("Aucune"))
    return { triggered: false, reason: "Aucune alerte : aucune modalité de transformation significative détectée." };

  if (baseline) {
    const triggered = baseline.zScore >= BASELINE_ALERT_Z;
    return {
      triggered,
      reason: triggered
        ? `Alerte : le score s'écarte de ${baseline.zScore.toFixed(2)} écart-type(s) de la distribution des paires indépendantes du même genre (n = ${baseline.corpusSize}).`
        : `Aucune alerte : le score reste dans l'intervalle attendu pour deux œuvres indépendantes de ce genre (${baseline.zScore.toFixed(2)} σ, n = ${baseline.corpusSize}).`,
    };
  }

  const triggered = sns >= ALERT_SNS_THRESHOLD;
  return {
    triggered,
    reason: triggered
      ? `Alerte : SNS ${sns.toFixed(3)} au-delà du seuil provisoire de ${ALERT_SNS_THRESHOLD}, avec une couverture de ${(coverage.ratio * 100).toFixed(0)} %. Seuil provisoire — aucune distribution nulle n'est encore calibrée pour ce genre.`
      : `Aucune alerte : SNS ${sns.toFixed(3)} sous le seuil provisoire de ${ALERT_SNS_THRESHOLD}.`,
  };
}

function readGenre(g: NarrativeGraph): string {
  const meta = asObj(g.metadata);
  return asStr(meta.genre);
}

function toGenreVerdict(c: GenreComparison): GenreVerdict {
  return {
    refGenre: c.refGenre,
    candGenre: c.candGenre,
    sameGenre: c.sameGenre,
    crossGenre: c.sameGenre === false,
  };
}

export function compare(
  gRef: NarrativeGraph,
  gCand: NarrativeGraph,
  options: CompareOptions = {},
): ComparisonResult {
  const idf = options.functionIdf ?? DEFAULT_FUNCTION_IDF;
  const contentSimilarity = options.contentSimilarity ?? defaultContentSimilarity;
  const weights = SNS_WEIGHT_PROFILES[options.weights ?? "v1"];

  const { score: sIso, correspondences, coverage } = scoreIsomorphism(gRef, gCand, idf, contentSimilarity);
  const sGed = scoreGed(gRef, gCand, coverage, idf);
  const sFunc = scoreFunctionSequence(gRef, gCand, idf);
  const sAct = scoreActantialChain(gRef, gCand);
  const sTens = scoreTensionProfile(gRef, gCand);

  const sns =
    weights.iso * sIso + weights.ged * sGed + weights.func * sFunc + weights.act * sAct + weights.tens * sTens;

  const genreComparison = compareGenres(readGenre(gRef), readGenre(gCand));
  const genre = toGenreVerdict(genreComparison);

  // P1-7 (anomalie A3) : la normalisation « par genre » n'a de sens qu'entre deux
  // œuvres du même genre. Elle ne doit jamais accroître le score quand les genres
  // diffèrent — ni quand ils sont indéterminés, faute de pouvoir l'affirmer.
  const normalizationApplied = genre.sameGenre === true;
  const snsNormalized = normalizationApplied ? Math.min(1, sns * 1.15) : sns;

  const ss = Math.max(0, (sns - 0.4) / 0.6);
  const st = scoreTransformation(gRef, gCand, sIso);
  const modality = classifyModality(gRef, gCand, sIso, sFunc, sTens);
  const [srj, srjLevel] = evaluateSrj(sns, ss, modality);

  // P2-8 : le score n'est rapporté à une distribution nulle que si celle-ci
  // existe pour un genre commun aux deux œuvres.
  const baselineEval = normalizationApplied ? evaluateAgainstBaseline(genreKey(genre.refGenre), sns) : null;
  const baseline = baselineEval
    ? {
        genreKey: baselineEval.genreKey,
        corpusSize: baselineEval.corpusSize,
        zScore: baselineEval.zScore,
        percentile: baselineEval.percentile,
      }
    : null;

  const verdict = buildVerdict(sns, ss, modality, genre, coverage);
  const warnings = buildWarnings(sns, gRef, gCand, genre, coverage);
  const alert = decideAlert(sns, modality, genre, coverage, baseline);

  return {
    sns, snsNormalized, ss, st, srj, srjLevel,
    sIso, sGed, sFunc, sAct, sTens,
    detectedModality: modality, verdict, correspondences, warnings,
    coverage, genre, normalizationApplied, baseline, alert,
  };
}
