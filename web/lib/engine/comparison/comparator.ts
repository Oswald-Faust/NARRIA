/**
 * Module 3 — Analyse comparative. Port fidèle de
 * `narria/m3_comparison/comparator.py`. Produit SNS, SS, ST, SRJ + modalité.
 */
import type {
  NarrativeGraph,
  NarrativeNode,
  ComparisonResult,
  Correspondence,
  Modalities,
  SrjLevel,
} from "../models";
import { functionSequence, tensionProfile } from "../models";

const W_ISO = 0.25;
const W_GED = 0.2;
const W_FUNC = 0.25;
const W_ACT = 0.15;
const W_TENS = 0.15;

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
    const set1 = new Set(n1.actants.map((a) => a.trim().toLowerCase()).filter(Boolean));
    const set2 = new Set(n2.actants.map((a) => a.trim().toLowerCase()).filter(Boolean));
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

function scoreIsomorphism(
  gRef: NarrativeGraph,
  gCand: NarrativeGraph,
): [number, Correspondence[]] {
  if (!gRef.nodes.length || !gCand.nodes.length) return [0, []];
  const MATCH_THRESHOLD = 0.4;

  const funcCounts = new Map<string, number>();
  for (const n of gCand.nodes) {
    if (n.functionCode) funcCounts.set(n.functionCode, (funcCounts.get(n.functionCode) ?? 0) + 1);
  }
  const nodeWeight = (node: NarrativeNode): number => {
    if (!node.functionCode) return 1.0;
    const occ = funcCounts.get(node.functionCode) ?? 1;
    return 1.0 / Math.sqrt(occ);
  };

  const correspondences: Correspondence[] = [];
  let weightedMatched = 0;
  let weightedTotal = 0;

  for (const cNode of gCand.nodes) {
    const w = nodeWeight(cNode);
    weightedTotal += w;
    let bestMatch: NarrativeNode | null = null;
    let bestScore = 0;
    for (const rNode of gRef.nodes) {
      const s = nodeSimilarity(rNode, cNode);
      if (s > bestScore) {
        bestScore = s;
        bestMatch = rNode;
      }
    }
    if (bestMatch && bestScore >= MATCH_THRESHOLD) {
      weightedMatched += w;
      correspondences.push({
        candNode: cNode.nodeId,
        candFunction: cNode.functionCode || "—",
        refNode: bestMatch.nodeId,
        refFunction: bestMatch.functionCode || "—",
        similarity: bestScore,
      });
    }
  }

  const score = weightedTotal > 0 ? weightedMatched / weightedTotal : 0;
  correspondences.sort((a, b) => b.similarity - a.similarity);
  return [score, correspondences];
}

function scoreGed(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  if (!gRef.nodes.length || !gCand.nodes.length) return 0;
  const funcsRef = new Set(gRef.nodes.filter((n) => n.functionCode).map((n) => n.functionCode!));
  const funcsCand = new Set(gCand.nodes.filter((n) => n.functionCode).map((n) => n.functionCode!));
  if (!funcsRef.size && !funcsCand.size) return 0.5;
  if (!funcsRef.size || !funcsCand.size) return 0;
  let inter = 0;
  for (const f of funcsRef) if (funcsCand.has(f)) inter += 1;
  const union = new Set([...funcsRef, ...funcsCand]).size;
  const jaccard = union > 0 ? inter / union : 0;
  const sizeDiff = Math.abs(gRef.nodes.length - gCand.nodes.length);
  const sizeMax = Math.max(gRef.nodes.length, gCand.nodes.length);
  const sizePenalty = sizeMax > 0 ? sizeDiff / sizeMax : 0;
  return Math.max(0, jaccard * (1 - 0.3 * sizePenalty));
}

function scoreFunctionSequence(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  let seqRef = functionSequence(gRef);
  let seqCand = functionSequence(gCand);
  if (!seqRef.length || !seqCand.length) return 0;
  seqRef = seqRef.filter((c) => !c.startsWith("FN"));
  seqCand = seqCand.filter((c) => !c.startsWith("FN"));
  if (!seqRef.length || !seqCand.length) return 0.5;

  const m = seqRef.length;
  const n = seqCand.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = seqRef[i - 1] === seqCand[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[m][n];
  const recouvrement = lcs / Math.min(m, n);
  const ratioLongueur = Math.min(m, n) / Math.max(m, n);
  return Math.sqrt(recouvrement * ratioLongueur);
}

function scoreActantialPersistence(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  if (!gRef.nodes.length || !gCand.nodes.length) return 0;
  const countActants = (g: NarrativeGraph) => {
    const m = new Map<string, number>();
    for (const node of g.nodes) for (const a of node.actants) m.set(a, (m.get(a) ?? 0) + 1);
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

function scoreTensionProfile(gRef: NarrativeGraph, gCand: NarrativeGraph): number {
  const sigRef = tensionProfile(gRef);
  const sigCand = tensionProfile(gCand);
  if (!sigRef.length || !sigCand.length) return 0;
  const targetLen = Math.min(sigRef.length, sigCand.length, 20);
  if (targetLen < 3) return 0.5;
  const a = resample(sigRef, targetLen);
  const b = resample(sigCand, targetLen);
  const meanA = a.reduce((s, v) => s + v, 0) / targetLen;
  const meanB = b.reduce((s, v) => s + v, 0) / targetLen;
  let num = 0;
  for (let i = 0; i < targetLen; i++) num += (a[i] - meanA) * (b[i] - meanB);
  const denA = Math.sqrt(a.reduce((s, v) => s + (v - meanA) ** 2, 0));
  const denB = Math.sqrt(b.reduce((s, v) => s + (v - meanB) ** 2, 0));
  if (denA === 0 || denB === 0) return 0.5;
  return (num / (denA * denB) + 1) / 2;
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

function buildVerdict(sns: number, ss: number, modality: string): string {
  if (sns < 0.3)
    return "Les deux œuvres présentent des structures narratives substantiellement différentes. Le SNS est faible et ne suggère pas de correspondance structurale significative. Cela n'exclut pas un emprunt textuel de surface, qui serait détecté par un outil distinct.";
  if (sns < 0.5)
    return `Les deux œuvres partagent certaines caractéristiques structurales. Cette similarité pourrait relever de conventions génériques communes plutôt que d'un emprunt spécifique (Score de Spécificité = ${ss.toFixed(2)}). Une analyse experte est recommandée pour vérifier si les correspondances relèvent de l'intertextualité légitime ou de l'emprunt non déclaré.`;
  if (sns < 0.7)
    return `Les deux œuvres présentent des correspondances structurales notables (modalité détectée : ${modality}). Le score dépasse ce qui est attendu d'une convergence indépendante dans le même genre. Il est fortement recommandé de consulter un narratologue et, le cas échéant, un juriste spécialisé en propriété intellectuelle avant toute conclusion.`;
  return `Les deux œuvres partagent une structure narrative profonde remarquablement similaire (modalité détectée : ${modality}). Cette similarité est difficilement explicable par la seule convergence indépendante. Une expertise narratologique et juridique approfondie est nécessaire. Ce résultat ne constitue PAS une preuve de plagiat : il est une indication à investiguer plus avant.`;
}

function buildWarnings(sns: number, gRef: NarrativeGraph, gCand: NarrativeGraph): string[] {
  const warnings: string[] = [];
  warnings.push(
    "Cette analyse est une aide à la décision — jamais un verdict. Aucun score, si élevé soit-il, ne constitue une preuve de plagiat. Les résultats de NARR'IA sont probabilistes et doivent toujours être soumis à l'appréciation d'une expertise humaine qualifiée (narratologue et, le cas échéant, juriste). NARR'IA n'établit pas le plagiat : il signale des correspondances structurales à investiguer.",
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

export function compare(gRef: NarrativeGraph, gCand: NarrativeGraph): ComparisonResult {
  const [sIso, correspondences] = scoreIsomorphism(gRef, gCand);
  const sGed = scoreGed(gRef, gCand);
  const sFunc = scoreFunctionSequence(gRef, gCand);
  const sAct = scoreActantialChain(gRef, gCand);
  const sTens = scoreTensionProfile(gRef, gCand);

  const sns = W_ISO * sIso + W_GED * sGed + W_FUNC * sFunc + W_ACT * sAct + W_TENS * sTens;
  const snsNormalized = Math.min(1, sns * 1.15);
  const ss = Math.max(0, (sns - 0.4) / 0.6);
  const st = scoreTransformation(gRef, gCand, sIso);
  const modality = classifyModality(gRef, gCand, sIso, sFunc, sTens);
  const [srj, srjLevel] = evaluateSrj(sns, ss, modality);
  const verdict = buildVerdict(sns, ss, modality);
  const warnings = buildWarnings(sns, gRef, gCand);

  return {
    sns, snsNormalized, ss, st, srj, srjLevel,
    sIso, sGed, sFunc, sAct, sTens,
    detectedModality: modality, verdict, correspondences, warnings,
  };
}
