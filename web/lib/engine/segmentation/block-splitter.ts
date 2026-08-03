/**
 * Découpage en blocs — règles impératives issues du retour des bêta-testeurs
 * (août 2026).
 *
 * Les quatre règles demandées sont MÉCANIQUES : elles ne dépendent que de la
 * mise en page, de la ponctuation et de marqueurs temporels listés. Elles sont
 * donc appliquées ici, en code déterministe, et non déléguées au modèle de
 * langage. Ce choix est la seule façon d'obtenir ce que la demande exige
 * réellement — « tu es un robot de découpage » : un LLM, même sous consigne
 * impérative, reste un échantillonneur et produisait 33 puis 35 blocs sur le
 * même texte (cf. `consensus.ts`). Ici, même texte → mêmes blocs, toujours,
 * sans appel réseau ni coût.
 *
 * ORDRE DES RÈGLES. Elles sont appliquées dans l'ordre prescrit, qui devient un
 * ordre de PRIORITÉ : chaque règle ne fait qu'AJOUTER des frontières, jamais en
 * retirer, et lorsqu'une position est atteinte par plusieurs règles, c'est la
 * première dans l'ordre qui est enregistrée comme cause du bloc (champ `rule`).
 * Une frontière posée par la règle du dialogue ne peut donc pas être défaite par
 * la règle de changement de sujet.
 *
 *   1. Dialogue        — changement de locuteur (ligne à tiret, ouverture de
 *                        guillemets, y compris en cours de ligne).
 *   2. Paragraphe      — toute ligne non vide ouvre un bloc.
 *   3. Saut temporel   — marqueur temporel explicite en tête de phrase ou de
 *                        proposition.
 *   4. Changement de sujet — le sujet grammatical de la phrase diffère du
 *                        dernier sujet explicite ; un pronom de reprise ne coupe
 *                        jamais.
 *
 * INTERDICTIONS. Elles sont respectées par construction :
 * - deux paragraphes ou deux répliques successifs ne peuvent jamais être
 *   fusionnés, puisque toute ligne non vide ouvre inconditionnellement un bloc ;
 * - un paragraphe n'est divisé que par la règle 3 ou la règle 4, seules règles
 *   opérant à l'intérieur d'une ligne (avec la règle 1 pour les répliques
 *   incluses en cours de ligne, explicitement prévue par la règle 1) ;
 * - aucune décision n'est prise sur le sens : le module n'a aucune notion de
 *   thème, d'épisode ni de fonction narrative.
 *
 * PORTÉE. Un bloc est une unité de SEGMENTATION, pas un nœud narratif. Le graphe
 * NarRep reste plafonné à 35 nœuds ; chaque nœud s'ancre sur une PLAGE de blocs
 * (`block_start`..`block_end`), ce qui donne enfin des coordonnées vérifiables à
 * la comparaison de structures — condition pour tester qu'une œuvre est un
 * sous-graphe d'une autre.
 */

/** Règle ayant ouvert un bloc, dans l'ordre de priorité prescrit. */
export type SplitRule = "dialogue" | "paragraphe" | "saut_temporel" | "changement_sujet";

const RULE_PRIORITY: Record<SplitRule, number> = {
  dialogue: 1,
  paragraphe: 2,
  saut_temporel: 3,
  changement_sujet: 4,
};

export interface NarrativeBlock {
  /** Identifiant séquentiel, 1-indexé. Sert de coordonnée d'ancrage aux nœuds. */
  id: number;
  /** Texte du bloc, tel qu'il figure dans l'œuvre (espaces de bord retirés). */
  texte_brut: string;
  /** Offset de début dans le texte source (inclus). */
  startChar: number;
  /** Offset de fin dans le texte source (exclu). */
  endChar: number;
  /** Règle qui a posé la frontière ouvrant ce bloc. */
  rule: SplitRule;
}

export interface BlockSplitOptions {
  /**
   * Position de la frontière pour la règle 3. La règle demande « un nouveau bloc
   * immédiatement après ce marqueur » ; deux lectures sont possibles et le choix
   * est laissé ouvert :
   * - `"before"` (défaut) — le marqueur OUVRE le nouveau bloc : « Le lendemain,
   *   Jean partit. » reste solidaire. C'est la lecture retenue, car couper après
   *   le marqueur produirait un bloc « Le lendemain, » orphelin, rattaché à la
   *   scène précédente à laquelle il n'appartient précisément plus.
   * - `"after"` — lecture littérale : la frontière tombe juste après le marqueur
   *   (et après la virgule qui le suit éventuellement).
   */
  temporalBoundary?: "before" | "after";
}

// ─────────────────────────────────────────────────────────────────────────────
// Règle 1 — Dialogue
// ─────────────────────────────────────────────────────────────────────────────

/** Tirets de dialogue : cadratin, demi-cadratin, barre horizontale, trait d'union. */
const DIALOGUE_DASH = /^[-‐‑‒–—―]/;
/** Guillemets ouvrants non ambigus (le guillemet droit `"` est traité par alternance). */
const UNAMBIGUOUS_OPENERS = new Set(["«", "“", "„", "‟"]);
/** Guillemets fermants, utilisés pour rétablir l'alternance du guillemet droit. */
const CLOSERS = new Set(["»", "”"]);

function isDialogueLineStart(line: string): boolean {
  return DIALOGUE_DASH.test(line) || UNAMBIGUOUS_OPENERS.has(line[0]) || line[0] === '"';
}

/**
 * Positions (absolues) d'ouverture de réplique à l'intérieur d'une ligne, hors
 * tout premier caractère — la frontière initiale étant déjà posée par la ligne.
 * Le guillemet droit `"`, ambigu, est considéré ouvrant une occurrence sur deux.
 */
function inlineDialogueOpenings(line: string, lineStart: number): number[] {
  const positions: number[] = [];
  let straightOpen = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (UNAMBIGUOUS_OPENERS.has(ch)) {
      if (i > 0) positions.push(lineStart + i);
      continue;
    }
    if (CLOSERS.has(ch)) continue;
    if (ch === '"') {
      straightOpen = !straightOpen;
      if (straightOpen && i > 0) positions.push(lineStart + i);
    }
  }
  return positions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Règle 3 — Saut temporel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marqueurs de rupture chronologique explicite. La liste est volontairement
 * restreinte aux locutions qui DATENT l'action les unes par rapport aux autres :
 * un adverbe d'intensité dramatique (« soudain », « brusquement ») n'est pas un
 * marqueur temporel au sens de la règle 3 et ne coupe pas.
 */
const TEMPORAL_PHRASES = [
  "le lendemain", "le surlendemain", "la veille", "l'avant-veille",
  "le jour suivant", "le jour d'après", "le jour même", "la nuit suivante",
  "le soir même", "le matin suivant", "le lendemain matin", "le lendemain soir",
  "au matin", "au soir", "à l'aube", "au crépuscule", "à la tombée de la nuit",
  "pendant ce temps", "au même moment", "dans le même temps", "à ce moment-là",
  "entre-temps", "entretemps", "sur ces entrefaites",
  "peu après", "peu avant", "aussitôt après", "juste après", "juste avant",
  "plus tard", "plus tôt", "longtemps après", "longtemps auparavant",
  "depuis lors", "dès lors", "à partir de ce jour", "à partir de ce moment",
  "un jour", "un matin", "un soir", "une nuit", "un beau jour",
  "ce jour-là", "ce soir-là", "cette nuit-là", "cette semaine-là",
  "des années plus tard", "bien des années plus tard", "quelques instants plus tard",
  "l'année suivante", "le mois suivant", "la semaine suivante", "l'instant d'après",
];

const QUANTIFIER = "(?:un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|vingt|trente|quarante|cinquante|cent|mille|quelques|plusieurs|maints|de\\s+longues|\\d+)";
const TIME_UNIT = "(?:secondes?|minutes?|heures?|jours?|nuits?|semaines?|mois|ans?|années?|décennies?|siècles?|lunes?|saisons?|hivers?|étés?|printemps|automnes?)";
const TIME_RELATION = "(?:plus\\s+tard|plus\\s+tôt|après|auparavant|durant|s'écoulèrent|passèrent|s'étaient\\s+écoulés?)";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reconnaît les marqueurs listés ainsi que la forme productive
 * « <quantité> <unité> <relation> » (« trois jours plus tard », « quelques
 * heures après »). L'apostrophe droite et l'apostrophe typographique sont
 * acceptées indifféremment.
 */
const TEMPORAL_ALTERNATION =
  "(?:" +
  TEMPORAL_PHRASES.map((p) => escapeRegExp(p).replace(/'/g, "['’]")).join("|") +
  `|${QUANTIFIER}\\s+${TIME_UNIT}\\s+${TIME_RELATION}` +
  `|après\\s+${QUANTIFIER}\\s+${TIME_UNIT}` +
  ")";

const TEMPORAL_RE = new RegExp(TEMPORAL_ALTERNATION, "giu");

/**
 * Même alternance, ancrée en tête et suivie de sa virgule. Sert à neutraliser le
 * complément circonstanciel temporel antéposé lors de la recherche du sujet :
 * dans « Le lendemain, il partit. », le sujet est « il », non « lendemain ».
 * La datation relève de la règle 3, jamais de la règle 4.
 */
const TEMPORAL_LEAD_RE = new RegExp(`^${TEMPORAL_ALTERNATION}\\s*,?\\s*`, "iu");

/** Ponctuations autorisant l'ouverture d'une proposition (règle 3). */
const CLAUSE_OPENERS = new Set([".", "!", "?", "…", ";", ":", ",", "»", "”", ")"]);

/** Le marqueur ouvre-t-il une phrase ou une proposition ? (sinon il est enchâssé). */
function opensClause(line: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const ch = line[i];
    if (/\s/.test(ch)) continue;
    return CLAUSE_OPENERS.has(ch) || DIALOGUE_DASH.test(ch);
  }
  return true; // début de ligne
}

// ─────────────────────────────────────────────────────────────────────────────
// Règle 4 — Changement de sujet
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_PRONOUNS = new Set([
  "il", "elle", "ils", "elles", "on", "je", "tu", "nous", "vous", "celui-ci",
  "celle-ci", "ceux-ci", "celles-ci", "lui", "l'un", "l'autre", "chacun", "tous",
]);

const DETERMINERS = new Set([
  "le", "la", "les", "l'", "un", "une", "des", "du", "de", "au", "aux",
  "son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes", "ton", "ta", "tes",
  "notre", "nos", "votre", "vos", "ce", "cet", "cette", "ces", "quelques",
  "plusieurs", "certains", "certaines", "tout", "toute", "tous", "toutes",
]);

/** Connecteurs en tête de phrase, transparents pour l'identification du sujet. */
const LEADING_CONNECTORS = new Set([
  "puis", "alors", "ensuite", "mais", "et", "or", "donc", "car", "cependant",
  "pourtant", "toutefois", "neanmoins", "ainsi", "aussi", "enfin", "soudain",
  "brusquement", "soudainement", "immediatement", "deja", "bientot", "certes",
  "d'ailleurs", "helas", "voici", "voila",
]);

/**
 * Prépositions ouvrant un complément circonstanciel antéposé. Les entrées sont
 * données SANS diacritiques : la comparaison passe par `normalizeWord`. « des »
 * et « du » en sont volontairement absents, leur emploi déterminant (« Des
 * soldats arrivèrent. ») primant largement sur leur emploi prépositionnel.
 */
const LEADING_PREPOSITIONS = new Set([
  "a", "au", "aux", "dans", "sur", "sous", "chez", "vers", "depuis", "pendant",
  "durant", "avant", "apres", "malgre", "par", "pour", "en", "entre", "parmi",
  "selon", "sans", "avec", "contre", "derriere", "devant", "pres", "loin",
  "lorsque", "quand", "tandis", "comme", "si", "jusqu'a", "afin",
]);

type Subject =
  | { kind: "pronoun" }
  | { kind: "named"; value: string }
  | { kind: "unknown" };

function normalizeWord(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z'’-]/g, "");
}

function isCapitalized(token: string): boolean {
  const first = token[0];
  return Boolean(first) && first === first.toLocaleUpperCase("fr") && first !== first.toLocaleLowerCase("fr");
}

/**
 * Sujet grammatical approché d'une phrase. L'heuristique est volontairement
 * conservatrice : tout ce qui n'est pas clairement un groupe nominal sujet est
 * rendu `unknown`, ce qui n'entraîne AUCUNE coupe — l'interdiction de diviser un
 * paragraphe prime en cas de doute.
 */
export function extractSubject(sentence: string): Subject {
  const cleaned = sentence
    .replace(/^[\s—–‒‐‑-]+/, "")
    .replace(/^[«"“„‟]\s*/, "")
    .replace(TEMPORAL_LEAD_RE, "");
  let tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { kind: "unknown" };

  // Connecteur en tête : transparent.
  while (tokens.length > 0 && LEADING_CONNECTORS.has(normalizeWord(tokens[0]).replace(/[',’]$/, ""))) {
    tokens = tokens.slice(1);
  }
  if (tokens.length === 0) return { kind: "unknown" };

  // Complément circonstanciel antéposé, borné par une virgule proche : transparent.
  if (LEADING_PREPOSITIONS.has(normalizeWord(tokens[0]))) {
    const commaAt = tokens.findIndex((t) => t.endsWith(","));
    if (commaAt >= 0 && commaAt < 8) tokens = tokens.slice(commaAt + 1);
    else return { kind: "unknown" };
  }
  if (tokens.length === 0) return { kind: "unknown" };

  const head = normalizeWord(tokens[0].replace(/[,;:.!?]+$/, ""));
  if (!head) return { kind: "unknown" };

  if (SUBJECT_PRONOUNS.has(head)) return { kind: "pronoun" };

  if (DETERMINERS.has(head) || head.startsWith("l'") || head.startsWith("d'")) {
    // Déterminant : le sujet est le premier nom qui suit.
    const elided = head.replace(/^[ld]'/, "");
    if (elided && !DETERMINERS.has(elided)) return { kind: "named", value: elided };
    for (let i = 1; i < Math.min(tokens.length, 4); i++) {
      const next = normalizeWord(tokens[i].replace(/[,;:.!?]+$/, ""));
      if (!next || DETERMINERS.has(next)) continue;
      return { kind: "named", value: next };
    }
    return { kind: "unknown" };
  }

  // Nom propre en tête (hors majuscule automatique de début de phrase : un mot
  // capitalisé qui n'est ni déterminant, ni pronom, ni connecteur).
  if (isCapitalized(tokens[0])) return { kind: "named", value: head };

  return { kind: "unknown" };
}

/** Découpe une portion en phrases, avec l'offset absolu de chacune. */
function splitSentences(text: string, baseOffset: number): { text: string; start: number }[] {
  const result: { text: string; start: number }[] = [];
  const re = /(?<=[.!?…])["»”)]*\s+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const chunk = text.slice(last, end);
    if (chunk.trim()) result.push({ text: chunk, start: baseOffset + last });
    last = end;
  }
  if (last < text.length) {
    const chunk = text.slice(last);
    if (chunk.trim()) result.push({ text: chunk, start: baseOffset + last });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemblage
// ─────────────────────────────────────────────────────────────────────────────

interface LineSpan {
  text: string;
  start: number;
}

/** Lignes non vides du texte, avec leur offset absolu (gère \n, \r\n et \r). */
function scanLines(text: string): LineSpan[] {
  const lines: LineSpan[] = [];
  const re = /\r\n|\n|\r/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (raw: string, offset: number) => {
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) lines.push({ text: trimmed, start: offset + leading });
  };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index), last);
    last = m.index + m[0].length;
  }
  if (last < text.length) push(text.slice(last), last);
  return lines;
}

/**
 * Applique les quatre règles et retourne les blocs. Déterministe : pour un même
 * texte et des mêmes options, la sortie est strictement identique.
 */
export function splitIntoBlocks(text: string, options: BlockSplitOptions = {}): NarrativeBlock[] {
  if (!text || !text.trim()) return [];
  const temporalBoundary = options.temporalBoundary ?? "before";

  /** position absolue → règle retenue (la plus prioritaire y ayant statué). */
  const cuts = new Map<number, SplitRule>();
  const addCut = (position: number, rule: SplitRule) => {
    if (position < 0 || position >= text.length) return;
    const existing = cuts.get(position);
    if (existing && RULE_PRIORITY[existing] <= RULE_PRIORITY[rule]) return;
    cuts.set(position, rule);
  };

  const lines = scanLines(text);

  for (const line of lines) {
    // ── Règle 1 puis règle 2 : toute ligne non vide ouvre un bloc. La règle du
    // dialogue étant prioritaire, une ligne de réplique est attribuée à celle-ci.
    addCut(line.start, isDialogueLineStart(line.text) ? "dialogue" : "paragraphe");

    // ── Règle 1 (suite) : répliques ouvertes en cours de ligne.
    for (const position of inlineDialogueOpenings(line.text, line.start)) {
      addCut(position, "dialogue");
    }

    // ── Règle 3 : marqueurs temporels en tête de phrase ou de proposition.
    TEMPORAL_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = TEMPORAL_RE.exec(line.text))) {
      if (!opensClause(line.text, tm.index)) continue;
      if (temporalBoundary === "before") {
        addCut(line.start + tm.index, "saut_temporel");
      } else {
        let after = tm.index + tm[0].length;
        while (after < line.text.length && /[\s,]/.test(line.text[after])) after++;
        addCut(line.start + after, "saut_temporel");
      }
    }

    // ── Règle 4 : changement de sujet entre phrases consécutives d'une ligne.
    const sentences = splitSentences(line.text, line.start);
    let lastNamed: string | null = null;
    for (const sentence of sentences) {
      const subject = extractSubject(sentence.text);
      if (subject.kind === "named") {
        // Un pronom de reprise ne coupe pas ; un sujet nommé différent, si.
        if (lastNamed !== null && subject.value !== lastNamed) {
          addCut(sentence.start, "changement_sujet");
        }
        lastNamed = subject.value;
      }
      // `pronoun` et `unknown` laissent le sujet de référence inchangé : « Il »
      // renvoie au dernier personnage nommé, conformément à la règle 4.
    }
  }

  // ── Matérialisation des blocs entre frontières successives.
  const positions = [...cuts.keys()].sort((a, b) => a - b);
  if (positions.length === 0 || positions[0] !== 0) positions.unshift(0);

  const blocks: NarrativeBlock[] = [];
  for (let i = 0; i < positions.length; i++) {
    const from = positions[i];
    const to = i + 1 < positions.length ? positions[i + 1] : text.length;
    const raw = text.slice(from, to);
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const leading = raw.length - raw.trimStart().length;
    blocks.push({
      id: blocks.length + 1,
      texte_brut: trimmed,
      startChar: from + leading,
      endChar: from + leading + trimmed.length,
      rule: cuts.get(from) ?? "paragraphe",
    });
  }
  return blocks;
}

/** Projection au format de sortie demandé : `[{ "id", "texte_brut" }, ...]`. */
export function toJsonBlocks(blocks: NarrativeBlock[]): { id: number; texte_brut: string }[] {
  return blocks.map(({ id, texte_brut }) => ({ id, texte_brut }));
}

/**
 * Rendu du texte découpé pour le prompt d'extraction. Chaque bloc est préfixé de
 * son identifiant entre crochets : le modèle n'a plus à décider des frontières,
 * il s'y réfère.
 */
export function renderBlocksForPrompt(blocks: NarrativeBlock[]): string {
  return blocks.map((b) => `[${b.id}] ${b.texte_brut}`).join("\n");
}

/** Retrouve le bloc contenant un offset donné (recherche binaire). */
export function blockAtChar(blocks: NarrativeBlock[], charIndex: number): NarrativeBlock | null {
  let low = 0;
  let high = blocks.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const block = blocks[mid];
    if (charIndex < block.startChar) high = mid - 1;
    else if (charIndex >= block.endChar) low = mid + 1;
    else return block;
  }
  return null;
}

/** Bornes de caractères couvertes par une plage de blocs, ou `null` si hors champ. */
export function charRangeForBlocks(
  blocks: NarrativeBlock[],
  blockStart: number,
  blockEnd: number,
): { startChar: number; endChar: number } | null {
  if (blocks.length === 0) return null;
  const first = Math.min(blockStart, blockEnd);
  const last = Math.max(blockStart, blockEnd);
  const from = blocks.find((b) => b.id === first);
  const to = [...blocks].reverse().find((b) => b.id === last);
  if (!from || !to) return null;
  return { startChar: from.startChar, endChar: to.endChar };
}
