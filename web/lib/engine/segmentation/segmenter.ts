/**
 * Module 1 — Segmentation narrative. Port fidèle de
 * `narria/m1_segmentation/segmenter.py`. Heuristiques pures, sans API externe.
 */

export interface NarrativeSegment {
  segmentId: string;
  text: string;
  startChar: number;
  endChar: number;
  wordCount: number;
  entities: string[];
  actions: string[];
}

/** Équivalent de Python `str.split()` (espaces multiples, trim, sans vides). */
function words(s: string): string[] {
  const t = s.trim();
  return t.length ? t.split(/\s+/) : [];
}

const ACTION_VERBS = [
  "part", "partit", "quitte", "quitta", "voulut", "veut", "décida", "décide",
  "rencontre", "rencontra", "cherche", "chercha", "recherche",
  "frappe", "frappa", "attaque", "attaqua", "combat", "combattit",
  "tue", "tua", "blessa", "blesse", "menace", "menaça",
  "aime", "aima", "épouse", "épousa", "déteste", "détesta", "trahit",
  "promet", "promit", "accepte", "accepta", "refuse", "refusa",
  "découvre", "découvrit", "comprend", "comprit", "apprend", "apprit",
  "révèle", "révéla", "avoue", "avoua", "cache", "cacha",
  "meurt", "mourut", "sauve", "sauva", "libère", "libéra", "triomphe",
  "échoue", "échoua", "pardonne", "pardonna", "vengea", "venge",
  "bénit", "maudit", "prie", "invoqua", "offre",
  "arrive", "arriva", "entra", "entre", "sortit", "sort",
  "donna", "donne", "reçut", "reçoit", "prit", "prend",
  "vit", "voit", "entendit", "entend", "parla", "parle",
];

const STOP_NAMES = new Set([
  "Il", "Elle", "Ils", "Elles", "On", "Je", "Tu", "Nous", "Vous",
  "Un", "Une", "Des", "Le", "La", "Les", "Ce", "Cette", "Ces",
  "Mais", "Cependant", "Lorsque", "Quand", "Alors", "Ainsi",
  "Puis", "Ensuite", "Tout", "Tous", "Toute", "Toutes", "Aussi",
  "Après", "Avant", "Depuis", "Pour", "Avec", "Sans", "Sous",
  "Dans", "Sur", "Chez", "Par", "Voici", "Voilà", "Oui", "Non",
  "Car", "Donc", "Or", "Ni",
]);

const CHARACTER_HINTS = /\b([A-Z][a-zà-ÿ]+(?:\s+(?:de |d')?[A-Z][a-zà-ÿ]+)?)\b/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  return normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitLong(paragraph: string, targetWords: number): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-ZÉÀÊÎÔ])/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const sent of sentences) {
    const wc = words(sent).length;
    if (currentWords + wc > targetWords && current.length) {
      chunks.push(current.join(" "));
      current = [sent];
      currentWords = wc;
    } else {
      current.push(sent);
      currentWords += wc;
    }
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

function groupChunks(paragraphs: string[], targetWords: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const para of paragraphs) {
    const wc = words(para).length;
    if (wc > targetWords * 2) {
      if (current.length) {
        chunks.push(current.join("\n\n"));
        current = [];
        currentWords = 0;
      }
      chunks.push(...splitLong(para, targetWords));
    } else if (currentWords + wc > targetWords && current.length) {
      chunks.push(current.join("\n\n"));
      current = [para];
      currentWords = wc;
    } else {
      current.push(para);
      currentWords += wc;
    }
  }
  if (current.length) chunks.push(current.join("\n\n"));
  return chunks;
}

/** Reproduit Counter(...).most_common(n) : tri par fréquence desc, ties = ordre d'apparition. */
function mostCommon(items: string[], n: number): [string, number][] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const it of items) {
    if (!counts.has(it)) order.push(it);
    counts.set(it, (counts.get(it) ?? 0) + 1);
  }
  const entries = order.map((k) => [k, counts.get(k)!] as [string, number]);
  // tri stable par count décroissant (l'ordre d'apparition est préservé pour les ties)
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, n);
}

function extractEntities(text: string): string[] {
  const matches = [...text.matchAll(CHARACTER_HINTS)].map((m) => m[1]);
  const counter = mostCommon(matches, 20);
  const entities: string[] = [];
  const seen = new Set<string>();
  for (const [name, count] of counter) {
    if (STOP_NAMES.has(name) || seen.has(name)) continue;
    if (name.length < 3) continue;
    if (count >= 2 || entities.length < 3) {
      entities.push(name);
      seen.add(name);
    }
  }
  return entities.slice(0, 10);
}

function extractActions(text: string): string[] {
  const lower = text.toLowerCase();
  const actions: string[] = [];
  for (const verb of ACTION_VERBS) {
    if (new RegExp(`\\b${escapeRegExp(verb)}\\b`).test(lower)) actions.push(verb);
  }
  return actions.slice(0, 8);
}

export function segment(text: string): NarrativeSegment[] {
  if (!text || text.trim().length < 50) return [];

  const paragraphs = splitParagraphs(text);
  const totalWords = paragraphs.reduce((s, p) => s + words(p).length, 0);

  let target: number;
  if (totalWords < 200) target = 40;
  else if (totalWords < 500) target = 80;
  else if (totalWords < 1500) target = 150;
  else target = 180;

  const chunks = groupChunks(paragraphs, target);

  const segments: NarrativeSegment[] = [];
  let charOffset = 0;
  chunks.forEach((chunk, i) => {
    const start =
      chunk.length >= 50 ? text.indexOf(chunk.slice(0, 50), charOffset) : charOffset;
    const end = start >= 0 ? start + chunk.length : charOffset + chunk.length;
    segments.push({
      segmentId: `s${String(i + 1).padStart(3, "0")}`,
      text: chunk,
      startChar: Math.max(0, start),
      endChar: end,
      wordCount: words(chunk).length,
      entities: extractEntities(chunk),
      actions: extractActions(chunk),
    });
    charOffset = end;
  });

  return segments;
}
