/**
 * Baseline empirique par genre (correctif P2-8 de la note interne du
 * 27/07/2026).
 *
 * Un SNS brut n'est pas interprétable dans l'absolu : 0,50 entre deux quêtes
 * initiatiques peut être la norme, quand 0,50 entre deux textes de genres
 * éloignés serait remarquable. Le verdict doit donc s'exprimer par rapport à la
 * distribution des scores observés sur des paires d'œuvres INDÉPENDANTES du
 * même genre, et l'alerte ne se déclencher qu'au-delà d'un écart significatif.
 *
 * Les distributions se peuplent par calibration (script hors ligne à venir sur
 * le corpus de référence). Tant qu'un genre n'a pas de distribution disposant
 * d'un effectif suffisant, `evaluateAgainstBaseline` retourne `null` et le
 * moteur retombe sur ses seuils fixes — en le disant explicitement dans le
 * rapport plutôt qu'en faisant comme si le score était calibré.
 */

export interface GenreNullDistribution {
  /** Nombre de paires indépendantes ayant servi à construire la distribution. */
  n: number;
  /** Moyenne des SNS observés sur ces paires. */
  mean: number;
  /** Écart-type des SNS observés. */
  sd: number;
}

export interface BaselineEvaluation {
  genreKey: string;
  /** Effectif de la distribution nulle utilisée. */
  corpusSize: number;
  mean: number;
  sd: number;
  /** Écart normalisé du score observé à la distribution nulle du genre. */
  zScore: number;
  /** Rang approximatif du score dans la distribution nulle, en pourcentage. */
  percentile: number;
}

/**
 * Distributions nulles connues, indexées par `genreKey`. Vide tant que la
 * calibration n'a pas été menée : aucune valeur inventée ici, une baseline
 * fausse serait pire que pas de baseline.
 */
export const GENRE_NULL_DISTRIBUTIONS: Readonly<Record<string, GenreNullDistribution>> = {};

/** Effectif minimal en deçà duquel une distribution n'est pas jugée exploitable. */
export const MIN_BASELINE_SAMPLE = 30;

/** Écart à la distribution nulle au-delà duquel une alerte est justifiée. */
export const BASELINE_ALERT_Z = 2;

/** Fonction de répartition de la loi normale centrée réduite (approximation d'Abramowitz–Stegun). */
function standardNormalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/**
 * Situe un SNS par rapport à la distribution nulle de son genre.
 * Retourne `null` si aucune distribution exploitable n'existe pour ce genre.
 */
export function evaluateAgainstBaseline(
  key: string,
  sns: number,
  distributions: Readonly<Record<string, GenreNullDistribution>> = GENRE_NULL_DISTRIBUTIONS,
): BaselineEvaluation | null {
  const dist = distributions[key];
  if (!dist || dist.n < MIN_BASELINE_SAMPLE || !(dist.sd > 0)) return null;
  const zScore = (sns - dist.mean) / dist.sd;
  return {
    genreKey: key,
    corpusSize: dist.n,
    mean: dist.mean,
    sd: dist.sd,
    zScore,
    percentile: standardNormalCdf(zScore) * 100,
  };
}
