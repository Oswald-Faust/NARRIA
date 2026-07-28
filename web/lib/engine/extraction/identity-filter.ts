/**
 * Filtre de sortie anti-inférence identitaire (correctif P0-1 de la note interne
 * du 27 juillet 2026, anomalie A8).
 *
 * NARR'IA est un outil d'analyse structurale : il ne doit produire AUCUNE
 * spéculation sur l'origine, l'appartenance culturelle ou l'identité d'un
 * auteur. Les rapports bêta avaient généré « contexte guinéen présumé, auteur
 * Halim » et « auteur francophone non identifié comme afrodescendant » — deux
 * énoncés qui ne relèvent pas de la narratologie et exposent à un risque de
 * biais et de réputation.
 *
 * Le prompt interdit désormais ces inférences en amont ; ce module en est le
 * filet de sécurité en aval : il retire tout segment incriminé avant que la
 * valeur n'atteigne le graphe, la base ou le rapport.
 */

/**
 * Limite de mot compatible avec les lettres accentuées. `\b` de JavaScript est
 * défini sur [A-Za-z0-9_] : « présumé » ou « écrivain », qui commencent ou
 * finissent par une lettre hors de cet ensemble, échappaient au filtre.
 */
function wordPattern(alternatives: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, "iu");
}

/**
 * Marqueurs désignant la *personne* qui écrit (par opposition au texte).
 * Leur seule présence dans un champ censé décrire une filiation textuelle
 * suffit à rejeter le segment.
 */
const AUTHOR_REFERENT = wordPattern(
  "auteur|auteure|auteurs|autrice|autrices|écrivain|écrivaine|écrivains|romancier|romancière|nouvelliste|conteur|conteuse|signataire|plume",
);

/**
 * Marqueurs d'assignation identitaire : origine, nationalité, ethnie,
 * appartenance culturelle ou raciale, y compris sous forme spéculative.
 */
const IDENTITY_ASSIGNMENT = wordPattern(
  "origine|origines|originaire|originaires|nationalité|nationalite|ethnie|ethnique|ascendance|ascendant|ascendants|descendance|afro-?descendant\\p{L}*|appartenance|identité|identite|diaspora|racines\\s+(?:culturelles|familiales)",
);

/**
 * Marqueurs spéculatifs. Un champ d'analyse structurale n'a pas à présumer.
 * Combinés à un référent d'auteur ou à une assignation identitaire, ils
 * signalent exactement le type d'énoncé produit lors des tests bêta.
 */
const SPECULATIVE = wordPattern(
  "présumé|présumée|présumés|présumées|presume|supposé|supposée|supposés|supposées|probablement|vraisemblablement|semble\\s+être|paraît\\s+être|sans\\s+doute|paraissant|peut-être",
);

/** Découpe une valeur en segments indépendamment filtrables (parenthèses, ponctuation faible). */
function splitSegments(value: string): string[] {
  return value
    .split(/[;,()\[\]]|\s[—–-]\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Un segment est-il une inférence sur la personne de l'auteur plutôt qu'une description du texte ? */
function isIdentityInference(segment: string): boolean {
  const hasAuthor = AUTHOR_REFERENT.test(segment);
  const hasIdentity = IDENTITY_ASSIGNMENT.test(segment);
  const hasSpeculation = SPECULATIVE.test(segment);
  // Toute mention de l'auteur dans un champ de filiation textuelle est hors périmètre.
  if (hasAuthor) return true;
  // Assignation identitaire, qu'elle soit affirmée ou présumée.
  if (hasIdentity) return true;
  // « contexte guinéen présumé » : spéculation sur un ancrage, sans référent explicite.
  if (hasSpeculation) return true;
  return false;
}

export interface SanitizedField {
  /** Valeur retenue, éventuellement vide si tout le contenu a été rejeté. */
  value: string;
  /** Segments écartés, conservés pour journalisation/audit — jamais affichés à l'utilisateur. */
  removed: string[];
}

/**
 * Retire d'une valeur courte (champ « tradition ») tout segment qui infère sur
 * l'identité de l'auteur. Retourne une chaîne vide si rien de recevable ne subsiste.
 */
export function sanitizeIdentityInference(value: string): SanitizedField {
  if (!value || !value.trim()) return { value: "", removed: [] };
  const segments = splitSegments(value);
  const kept: string[] = [];
  const removed: string[] = [];
  for (const seg of segments) {
    if (isIdentityInference(seg)) removed.push(seg);
    else kept.push(seg);
  }
  if (removed.length === 0) return { value: value.trim(), removed: [] };
  return { value: kept.join(", "), removed };
}

/**
 * Variante pour les champs en prose libre (résumé, signature stylistique) : ne
 * retire que les phrases qui parlent explicitement de l'auteur en tant que
 * personne, afin de ne pas mutiler une description légitime de l'intrigue
 * (un personnage peut être guinéen ; l'auteur n'a pas à être qualifié).
 */
export function sanitizeProseIdentityInference(value: string): SanitizedField {
  if (!value || !value.trim()) return { value: "", removed: [] };
  const sentences = value.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const kept: string[] = [];
  const removed: string[] = [];
  for (const sentence of sentences) {
    const targetsAuthor =
      AUTHOR_REFERENT.test(sentence) && (IDENTITY_ASSIGNMENT.test(sentence) || SPECULATIVE.test(sentence));
    if (targetsAuthor) removed.push(sentence.trim());
    else kept.push(sentence.trim());
  }
  if (removed.length === 0) return { value: value.trim(), removed: [] };
  return { value: kept.join(" ").trim(), removed };
}
