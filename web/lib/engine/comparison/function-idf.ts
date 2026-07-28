/**
 * Pondération par spécificité de fonction — « IDF fonctionnel »
 * (correctif P1-4 de la note interne du 27/07/2026, anomalie A1).
 *
 * Les fonctions cardinales n'ont pas toutes le même pouvoir discriminant : F13
 * (Cheminement) ou F20 (Combat) apparaissent dans la quasi-totalité des récits,
 * tandis que FNMALA (Malédiction) ou F55 (Héritage) sont rares. Apparier deux
 * nœuds sur la seule étiquette F20 ne dit presque rien ; les apparier sur
 * FNMALA est un signal fort. Le score doit refléter cet écart.
 *
 * On pondère donc chaque appariement par l'inverse de la fréquence documentaire
 * de la fonction dans un corpus de référence : w(f) = -ln(df(f)) / -ln(DF_PIVOT),
 * borné pour éviter qu'une fonction très rare écrase tout le reste.
 */

/**
 * Fréquence documentaire de référence : proportion des récits d'un corpus dans
 * lesquels la fonction apparaît au moins une fois. Valeurs de départ établies à
 * dire d'expert sur le répertoire NARR'IA, en attendant la calibration empirique
 * du point P2-8 (baseline par genre) — `withCorpusFrequencies` permet de les
 * remplacer par des fréquences observées dès qu'un corpus est disponible.
 */
export const REFERENCE_DOCUMENT_FREQUENCY: Readonly<Record<string, number>> = {
  // Famille 1 — Rupture initiale
  F01: 0.55, F02: 0.74, F03: 0.52, F04: 0.18, F05: 0.30, F06: 0.14, F07: 0.28,
  // Famille 2 — Quête et cheminement
  F10: 0.76, F11: 0.34, F12: 0.48, F13: 0.88, F14: 0.18, F15: 0.32, F16: 0.30,
  // Famille 3 — Obstacles et conflits
  F20: 0.72, F21: 0.30, F22: 0.78, F23: 0.28, F24: 0.46, F25: 0.14, F26: 0.16,
  F27: 0.40, F28: 0.80,
  // Famille 4 — Pivot et reconnaissance
  F30: 0.50, F31: 0.62, F32: 0.30, F33: 0.20, F34: 0.42, F35: 0.12,
  // Famille 5 — Résolution
  F40: 0.30, F41: 0.58, F42: 0.38, F43: 0.34, F44: 0.18, F45: 0.24, F46: 0.16,
  F47: 0.20, F48: 0.20, F49: 0.26,
  // Famille 6 — Liaisons et relations
  F50: 0.32, F51: 0.18, F52: 0.22, F53: 0.34, F54: 0.30, F55: 0.10, F56: 0.14,
  // Famille 7 — Fonctions propres aux traditions africaines
  FNAL: 0.05, FNANC: 0.04, FNBENI: 0.05, FNCOMM: 0.06, FNGR: 0.05,
  FNMALA: 0.04, FNPROV: 0.06,
};

/** Fréquence supposée d'une fonction absente de la table (prudence : ni rare, ni banale). */
const DEFAULT_DOCUMENT_FREQUENCY = 0.25;

/** Fréquence pivot : une fonction à cette fréquence reçoit exactement le poids 1. */
const DF_PIVOT = 0.25;

/** Bornes du poids, pour qu'aucune fonction ne soit ni négligée ni écrasante. */
const WEIGHT_MIN = 0.15;
const WEIGHT_MAX = 2.5;

/** Poids d'un nœud sans fonction identifiée : neutre, mais compté dans la couverture. */
const UNLABELLED_WEIGHT = 1.0;

const PIVOT_IDF = -Math.log(DF_PIVOT);

export interface FunctionIdf {
  /** Poids de spécificité d'une fonction (1 = fonction de fréquence pivot). */
  weight(code: string | null | undefined): number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Construit une table de poids à partir de fréquences documentaires. */
export function buildFunctionIdf(
  frequencies: Readonly<Record<string, number>> = REFERENCE_DOCUMENT_FREQUENCY,
): FunctionIdf {
  const cache = new Map<string, number>();
  return {
    weight(code) {
      if (!code) return UNLABELLED_WEIGHT;
      const cached = cache.get(code);
      if (cached !== undefined) return cached;
      const rawDf = frequencies[code] ?? DEFAULT_DOCUMENT_FREQUENCY;
      // Une fréquence nulle ou ≥ 1 n'a pas de sens : on la ramène dans ]0, 1[.
      const df = clamp(rawDf, 1e-4, 0.9999);
      const w = clamp(-Math.log(df) / PIVOT_IDF, WEIGHT_MIN, WEIGHT_MAX);
      cache.set(code, w);
      return w;
    },
  };
}

/**
 * Table par défaut, utilisée par le comparateur. Remplacer par
 * `buildFunctionIdf(observedFrequencies)` dès qu'un corpus de référence est
 * constitué (cf. P2-8).
 */
export const DEFAULT_FUNCTION_IDF = buildFunctionIdf();

/**
 * Combine la spécificité inter-corpus (IDF) et la spécificité intra-graphe : une
 * fonction répétée dix fois dans le même récit ne vaut pas dix appariements
 * indépendants. Reprend l'atténuation en 1/√occurrences du moteur d'origine.
 */
export function nodeSpecificityWeight(
  code: string | null | undefined,
  occurrencesInGraph: number,
  idf: FunctionIdf = DEFAULT_FUNCTION_IDF,
): number {
  const occ = Math.max(1, occurrencesInGraph);
  return idf.weight(code) / Math.sqrt(occ);
}
