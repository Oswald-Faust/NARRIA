/**
 * Découpage des textes longs et fusion des graphes partiels — port fidèle de
 * `narria/llm/chunker.py`.
 */
import type { LlmAnalysis, LlmNode } from "./llm-schema";

const CHARS_PER_TOKEN = 4;
const MODEL_CONTEXT_LIMIT = 200_000;
const SAFETY_MARGIN = 60_000;
export const CHUNK_THRESHOLD_TOKENS = MODEL_CONTEXT_LIMIT - SAFETY_MARGIN; // 140_000
const TARGET_CHUNK_TOKENS = 90_000;
const OVERLAP_TOKENS = 6_000;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.floor((text.length / CHARS_PER_TOKEN) * 1.2);
}

export function needsChunking(text: string): boolean {
  return estimateTokens(text) > CHUNK_THRESHOLD_TOKENS;
}

export interface TextChunk {
  index: number;
  totalChunks: number;
  text: string;
  charStart: number;
  charEnd: number;
  estimatedTokens: number;
  hasOverlapBefore: boolean;
  hasOverlapAfter: boolean;
}

interface ParaSpan {
  text: string;
  start: number;
  end: number;
}

function splitOversizedParagraph(text: string, baseOffset: number, targetChars: number): ParaSpan[] {
  const sentenceRe = /(?<=[.!?])\s+(?=[A-ZÉÈÀÂÎÔÛÜŒÆ])/g;
  const sentences: ParaSpan[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(text))) {
    sentences.push({ text: text.slice(last, m.index).trim(), start: last, end: m.index });
    last = m.index + m[0].length;
  }
  if (last < text.length) sentences.push({ text: text.slice(last).trim(), start: last, end: text.length });

  if (sentences.length >= 3) {
    const pieces: ParaSpan[] = [];
    let currentText: string[] = [];
    let currentStart = sentences[0].start;
    let currentEnd = sentences[0].start;
    let currentSize = 0;

    for (const s of sentences) {
      const sLen = s.end - s.start;
      if (currentSize + sLen > targetChars && currentText.length > 0) {
        pieces.push({ text: currentText.join(" "), start: baseOffset + currentStart, end: baseOffset + currentEnd });
        currentText = [s.text];
        currentStart = s.start;
        currentEnd = s.end;
        currentSize = sLen;
      } else {
        if (currentText.length === 0) currentStart = s.start;
        currentText.push(s.text);
        currentEnd = s.end;
        currentSize += sLen;
      }
    }
    if (currentText.length > 0) {
      pieces.push({ text: currentText.join(" "), start: baseOffset + currentStart, end: baseOffset + currentEnd });
    }
    const allReasonable = pieces.every((p) => p.end - p.start <= targetChars * 1.2);
    if (allReasonable) return pieces;
  }

  const pieces: ParaSpan[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + targetChars, text.length);
    if (end < text.length) {
      for (let bp = end; bp > Math.max(end - 200, pos + 1); bp--) {
        if (" .!?".includes(text[bp])) {
          end = bp + 1;
          break;
        }
      }
    }
    pieces.push({ text: text.slice(pos, end).trim(), start: baseOffset + pos, end: baseOffset + end });
    pos = end;
  }
  return pieces;
}

function splitParagraphs(text: string): ParaSpan[] {
  const paragraphs: ParaSpan[] = [];
  const pattern = /\n\s*\n/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const paraText = text.slice(lastEnd, m.index).trim();
    if (paraText) {
      let realStart = lastEnd;
      while (realStart < m.index && /\s/.test(text[realStart])) realStart++;
      paragraphs.push({ text: paraText, start: realStart, end: m.index });
    }
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) {
    const paraText = text.slice(lastEnd).trim();
    if (paraText) {
      let realStart = lastEnd;
      while (realStart < text.length && /\s/.test(text[realStart])) realStart++;
      paragraphs.push({ text: paraText, start: realStart, end: text.length });
    }
  }
  if (paragraphs.length === 0 && text.trim()) {
    paragraphs.push({ text: text.trim(), start: 0, end: text.length });
  }

  const maxParaChars = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
  const refined: ParaSpan[] = [];
  for (const p of paragraphs) {
    if (p.end - p.start <= maxParaChars) {
      refined.push(p);
    } else {
      refined.push(...splitOversizedParagraph(p.text, p.start, maxParaChars));
    }
  }
  return refined;
}

export function chunkText(
  text: string,
  targetTokens: number = TARGET_CHUNK_TOKENS,
  overlapTokens: number = OVERLAP_TOKENS,
): TextChunk[] {
  if (!text || !text.trim()) return [];

  if (estimateTokens(text) <= targetTokens) {
    return [
      {
        index: 0,
        totalChunks: 1,
        text,
        charStart: 0,
        charEnd: text.length,
        estimatedTokens: estimateTokens(text),
        hasOverlapBefore: false,
        hasOverlapAfter: false,
      },
    ];
  }

  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const paragraphs = splitParagraphs(text);

  const chunksRaw: ParaSpan[] = [];
  let currentParas: ParaSpan[] = [];
  let currentSize = 0;

  function finalizeCurrent() {
    if (currentParas.length === 0) return;
    chunksRaw.push({
      text: currentParas.map((p) => p.text).join("\n\n"),
      start: currentParas[0].start,
      end: currentParas[currentParas.length - 1].end,
    });
  }

  function computeOverlapParas(): { paras: ParaSpan[]; size: number } {
    const overlapParas: ParaSpan[] = [];
    let overlapSize = 0;
    for (let i = currentParas.length - 1; i >= 0; i--) {
      const op = currentParas[i];
      const opLen = op.end - op.start;
      if (overlapSize + opLen > overlapChars && overlapParas.length > 0) break;
      overlapParas.unshift(op);
      overlapSize += opLen;
      if (overlapSize >= overlapChars) break;
    }
    return { paras: overlapParas, size: overlapSize };
  }

  for (const p of paragraphs) {
    const pLen = p.end - p.start;

    if (pLen > targetChars) {
      if (currentParas.length > 0) {
        finalizeCurrent();
        currentParas = [];
        currentSize = 0;
      }
      chunksRaw.push({ text: p.text, start: p.start, end: p.end });
      continue;
    }

    if (currentSize + pLen > targetChars && currentParas.length > 0) {
      finalizeCurrent();
      const { paras, size } = computeOverlapParas();
      currentParas = paras;
      currentSize = size;
      if (currentSize + pLen > targetChars && currentParas.length > 0) {
        finalizeCurrent();
        currentParas = [];
        currentSize = 0;
      }
    }

    currentParas.push(p);
    currentSize += pLen;
  }
  finalizeCurrent();

  const total = chunksRaw.length;
  return chunksRaw.map((c, i) => ({
    index: i,
    totalChunks: total,
    text: c.text,
    charStart: c.start,
    charEnd: c.end,
    estimatedTokens: estimateTokens(c.text),
    hasOverlapBefore: i > 0,
    hasOverlapAfter: i < total - 1,
  }));
}

// ─── Fusion des graphes partiels (port de merge_partial_graphs) ───

function mostCommon(values: string[]): string {
  if (values.length === 0) return "";
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function synthesizeSummaries(summaries: string[]): string {
  if (summaries.length === 0) return "";
  if (summaries.length === 1) return summaries[0];
  return summaries.map((s, i) => `Partie ${i + 1}/${summaries.length} : ${s}`).join(" ");
}

const ACTANT_KEYS = ["protagoniste", "objet", "destinateur", "destinataire", "adjuvant", "opposant"] as const;

function mergeActantConfig(
  configs: LlmAnalysis["main_actants_v1"][],
  focus: string,
  description: string,
): LlmAnalysis["main_actants_v1"] {
  const merged: Record<string, string> = { _focus: focus, _description: description };
  for (const key of ACTANT_KEYS) {
    const values = configs.map((c) => (c[key] ?? "").trim()).filter(Boolean);
    if (values.length > 0) merged[key] = mostCommon(values);
  }
  return merged as LlmAnalysis["main_actants_v1"];
}

function isDuplicateNode(a: LlmNode, b: LlmNode): boolean {
  if (a.function_code && b.function_code && a.function_code !== b.function_code) return false;
  const textA = (a.text_excerpt ?? "").toLowerCase();
  const textB = (b.text_excerpt ?? "").toLowerCase();
  if (!textA || !textB) return false;
  const wordsA = new Set(textA.match(/\w{4,}/g) ?? []);
  const wordsB = new Set(textB.match(/\w{4,}/g) ?? []);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const smaller = Math.min(wordsA.size, wordsB.size);
  return smaller > 0 && intersection / smaller > 0.5;
}

function deduplicateOverlapNodes(
  allNodes: (LlmNode & { _chunkIndex: number })[],
): (LlmNode & { _chunkIndex: number })[] {
  if (allNodes.length <= 1) return allNodes;
  const keep = allNodes.map(() => true);

  for (let i = 0; i < allNodes.length; i++) {
    if (!keep[i]) continue;
    const chunkI = allNodes[i]._chunkIndex;
    for (let j = i + 1; j < allNodes.length; j++) {
      if (!keep[j]) continue;
      const chunkJ = allNodes[j]._chunkIndex;
      if (Math.abs(chunkJ - chunkI) > 1) break;
      if (chunkJ === chunkI) continue;
      if (isDuplicateNode(allNodes[i], allNodes[j])) keep[j] = false;
    }
  }
  return allNodes.filter((_, i) => keep[i]);
}

export interface MergeInfo {
  nChunks: number;
  nNodesBeforeDedup: number;
  nNodesAfterDedup: number;
  nDuplicatesRemoved: number;
}

export interface MergedResult {
  analysis: LlmAnalysis;
  mergeInfo: MergeInfo;
}

export function mergePartialGraphs(partialResults: LlmAnalysis[], chunks: TextChunk[]): MergedResult {
  void chunks;

  if (partialResults.length === 0) {
    throw new Error("mergePartialGraphs: aucun résultat partiel à fusionner.");
  }

  if (partialResults.length === 1) {
    const only = partialResults[0];
    return {
      analysis: only,
      mergeInfo: {
        nChunks: 1,
        nNodesBeforeDedup: only.nodes.length,
        nNodesAfterDedup: only.nodes.length,
        nDuplicatesRemoved: 0,
      },
    };
  }

  const genres = partialResults.map((r) => r.genre).filter(Boolean);
  const traditions = partialResults.map((r) => r.tradition).filter(Boolean);
  const globalGenre = mostCommon(genres);
  const globalTradition = mostCommon(traditions);

  const summaries = partialResults.map((r) => r.summary).filter(Boolean);
  const globalSummary = synthesizeSummaries(summaries);

  const allKeywords: string[] = [];
  for (const r of partialResults) {
    for (const kw of r.thematic_keywords ?? []) {
      if (kw && !allKeywords.includes(kw)) allKeywords.push(kw);
    }
  }

  const mainActantsV1 = mergeActantConfig(
    partialResults.map((r) => r.main_actants_v1),
    "agent_actif",
    "Configuration où le Sujet est l'agent qui pose et conduit l'action principale",
  );
  const mainActantsV2 = mergeActantConfig(
    partialResults.map((r) => r.main_actants_v2),
    "patient_central",
    "Configuration où le Sujet est celui qui subit l'action principale ou en est l'enjeu",
  );

  const allNodes: (LlmNode & { _chunkIndex: number })[] = [];
  partialResults.forEach((result, chunkIdx) => {
    for (const node of result.nodes) allNodes.push({ ...node, _chunkIndex: chunkIdx });
  });

  const nBefore = allNodes.length;
  const deduped = deduplicateOverlapNodes(allNodes);
  const nAfter = deduped.length;

  const renumbered: LlmNode[] = deduped.map((node, i) => {
    const { _chunkIndex, ...rest } = node;
    void _chunkIndex;
    return { ...rest, sequence: i + 1 };
  });

  const formalFeatures = partialResults[0].formal_features;

  return {
    analysis: {
      summary: globalSummary,
      genre: globalGenre,
      tradition: globalTradition,
      formal_features: formalFeatures,
      nodes: renumbered,
      main_actants_v1: mainActantsV1,
      main_actants_v2: mainActantsV2,
      thematic_keywords: allKeywords.slice(0, 20),
    },
    mergeInfo: {
      nChunks: partialResults.length,
      nNodesBeforeDedup: nBefore,
      nNodesAfterDedup: nAfter,
      nDuplicatesRemoved: nBefore - nAfter,
    },
  };
}
