/**
 * Similarité de contenu entre deux nœuds narratifs — seuil d'appariement
 * (correctif P1-5 de la note interne du 27/07/2026, anomalie A1).
 *
 * L'appariement de nœuds se fondait sur la seule étiquette de fonction et la
 * structure locale, sans vérifier ce que les nœuds racontent : un combat contre
 * un dragon et la neutralisation silencieuse d'un terroriste étaient appariés à
 * ~80 % au motif qu'ils portent tous deux F20. On exige désormais, en plus de
 * l'étiquette, un recouvrement minimal de contenu — extrait cité et actants.
 *
 * DEUX MESURES COMPLÉMENTAIRES. Lorsque les nœuds portent un vecteur sémantique
 * — calculé à l'extraction, cf. `embeddings.ts` — la similarité retenue est la
 * meilleure des deux : recouvrement lexical et cosinus recalé. L'embedding
 * rapproche ce que le lexical rate (synonymie, reformulation) ; le lexical
 * rattrape ce que l'embedding lisse (deux scènes de combat sont sémantiquement
 * voisines sans raconter la même chose). Prendre le maximum ne dégrade jamais la
 * détection par rapport au lexical seul.
 *
 * Sans fournisseur d'embeddings configuré, seul le proxy lexical opère : plus
 * conservateur, mais suffisant pour écarter les collisions d'étiquettes, qui
 * sont le cas visé. Le seuil est volontairement bas : c'est un garde-fou, pas un
 * critère de similarité. `compare(..., { contentSimilarity })` permet d'injecter
 * toute autre mesure sans toucher au reste du moteur.
 */
import type { NarrativeNode } from "../models";
import { embeddingContentSimilarity } from "./embeddings";

/** Mots-outils français, écartés du calcul de recouvrement. */
const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "que", "qui", "quoi",
  "dont", "ou", "son", "sa", "ses", "leur", "leurs", "ce", "cet", "cette", "ces",
  "il", "elle", "ils", "elles", "on", "nous", "vous", "je", "tu", "me", "te", "se",
  "pour", "par", "sur", "sous", "dans", "avec", "sans", "chez", "vers", "entre",
  "est", "sont", "etre", "avoir", "avait", "etait", "ete", "fait", "faire",
  "plus", "moins", "tres", "tout", "tous", "toute", "toutes", "aucun", "aucune",
  "mais", "donc", "car", "puis", "alors", "quand", "comme", "ainsi", "meme",
  "au", "aux", "en", "y", "ne", "pas", "si", "lui", "leurs", "dune", "duns",
  "sujet", "objet", "protagoniste", "personnage", "antagoniste",
]);

/** Retire les diacritiques et la ponctuation, découpe en mots signifiants (≥ 3 lettres). */
export function tokenize(value: string): Set<string> {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const words = normalized.match(/[a-z]{3,}/g) ?? [];
  return new Set(words.filter((w) => !STOPWORDS.has(w)));
}

/**
 * Coefficient de recouvrement |A ∩ B| / min(|A|, |B|) — préféré au Jaccard car
 * les extraits comparés ont souvent des longueurs très inégales (une phrase
 * citée d'un côté, un paragraphe de l'autre).
 */
export function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) inter += 1;
  return inter / small.size;
}

/**
 * Normalise un actant en forme canonique : « Roméo (sujet) » et « roméo »
 * deviennent le même token. Sert aussi à la stabilisation de l'extraction (P2-9).
 */
export function canonicalizeActant(actant: string): string {
  return actant
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\b(le|la|les|un|une|des|du|de|d)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Tokens issus de la liste d'actants d'un nœud, en forme canonique. */
function actantTokens(node: NarrativeNode): Set<string> {
  const out = new Set<string>();
  for (const a of node.actants) {
    for (const token of tokenize(canonicalizeActant(a))) out.add(token);
  }
  return out;
}

export type ContentSimilarityFn = (a: NarrativeNode, b: NarrativeNode) => number;

/**
 * Recouvrement de contenu entre deux nœuds : on retient le meilleur des deux
 * signaux disponibles (ce qui est raconté, qui le vit). Deux scènes réellement
 * apparentées se ressemblent au moins par l'un des deux ; deux scènes qui ne
 * partagent que leur étiquette de fonction ne se ressemblent par aucun.
 */
export const lexicalContentSimilarity: ContentSimilarityFn = (a, b) => {
  const excerpt = overlapCoefficient(tokenize(a.textExcerpt ?? ""), tokenize(b.textExcerpt ?? ""));
  const actants = overlapCoefficient(actantTokens(a), actantTokens(b));
  return Math.max(excerpt, actants);
};

/**
 * Mesure par défaut du moteur : lexicale, complétée par le cosinus des
 * embeddings lorsque les deux nœuds en portent un. Se réduit exactement à
 * `lexicalContentSimilarity` en l'absence de vecteurs.
 */
export const contentSimilarity: ContentSimilarityFn = (a, b) => {
  const lexical = lexicalContentSimilarity(a, b);
  const semantic = embeddingContentSimilarity(a, b);
  return semantic === null ? lexical : Math.max(lexical, semantic);
};

/**
 * Seuil minimal de recouvrement exigé pour qu'un appariement soit retenu.
 * Bas à dessein : écarter les collisions d'étiquettes sans exiger une reprise
 * mot pour mot, que le score structural n'a pas vocation à mesurer.
 */
export const CONTENT_MATCH_THRESHOLD = 0.1;
