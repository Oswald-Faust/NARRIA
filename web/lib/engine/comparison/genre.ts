/**
 * Comparaison des genres détectés — support des correctifs P0-2 (template de
 * verdict conditionné) et P1-7 (normalisation SNS_N) de la note interne du
 * 27/07/2026, anomalies A3 et A4.
 *
 * Le moteur affirmait « le score dépasse ce qui est attendu d'une convergence
 * indépendante dans le même genre » et appliquait une normalisation « par
 * genre » alors même que les deux œuvres relevaient de genres distincts. Une
 * normalisation par genre appliquée à deux genres différents n'a pas de
 * sémantique définie : il faut d'abord savoir si les genres coïncident.
 */
import { overlapCoefficient, tokenize } from "./content-similarity";

/** Mots vides propres aux libellés de genre (« récit de quête » ≡ « quête »). */
const GENRE_FILLERS = new Set(["recit", "roman", "nouvelle", "texte", "oeuvre", "genre", "type", "style"]);

function genreTokens(genre: string): Set<string> {
  const tokens = tokenize(genre);
  for (const filler of GENRE_FILLERS) tokens.delete(filler);
  return tokens;
}

/** Recouvrement minimal de vocabulaire pour considérer deux libellés comme le même genre. */
const GENRE_AGREEMENT_THRESHOLD = 0.5;

export interface GenreComparison {
  refGenre: string;
  candGenre: string;
  /**
   * `true` si les deux libellés désignent le même genre, `false` s'ils
   * divergent, `null` si l'un des deux est absent — auquel cas rien ne peut
   * être affirmé, et le moteur applique la lecture la plus prudente.
   */
  sameGenre: boolean | null;
  /** Recouvrement lexical mesuré entre les deux libellés, pour traçabilité. */
  overlap: number;
}

export function compareGenres(refGenre: string, candGenre: string): GenreComparison {
  const ref = (refGenre ?? "").trim();
  const cand = (candGenre ?? "").trim();
  if (!ref || !cand) return { refGenre: ref, candGenre: cand, sameGenre: null, overlap: 0 };

  const tokensRef = genreTokens(ref);
  const tokensCand = genreTokens(cand);
  // Deux libellés vidés de leur substance (« récit », « texte ») : indéterminé.
  if (!tokensRef.size || !tokensCand.size) {
    const identical = ref.toLowerCase() === cand.toLowerCase();
    return { refGenre: ref, candGenre: cand, sameGenre: identical ? true : null, overlap: identical ? 1 : 0 };
  }

  const overlap = overlapCoefficient(tokensRef, tokensCand);
  return {
    refGenre: ref,
    candGenre: cand,
    sameGenre: overlap >= GENRE_AGREEMENT_THRESHOLD,
    overlap,
  };
}

/** Clé de regroupement d'un genre, utilisée pour indexer les baselines empiriques. */
export function genreKey(genre: string): string {
  return [...genreTokens(genre)].sort().join("-") || "indetermine";
}
