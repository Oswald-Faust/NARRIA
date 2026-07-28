/**
 * Recouvrement textuel de surface — seconde jambe de la comparaison.
 *
 * Retour des bêta-testeurs : « si je compare une œuvre avec son dixième,
 * logiquement je dois obtenir environ 10 % de son architecture. Après
 * comparaison, j'aurai 10 % de correspondance, pourtant il y a 100 % de
 * plagiat. » Le diagnostic est juste, et il tient à la nature même du score
 * structurel : un Dice est SYMÉTRIQUE, donc nécessairement pénalisé par
 * l'écart de taille. Aucun réglage de la comparaison de graphes ne peut le
 * corriger, parce que ce n'est pas une erreur de calcul mais la définition de
 * la mesure.
 *
 * La réponse est d'ajouter une mesure ASYMÉTRIQUE — le taux de confinement,
 * « quelle part de l'œuvre courte se retrouve dans la longue » — et de la
 * calculer aussi sur le texte, là où la reprise littérale se voit sans
 * dépendre du découpage produit par le modèle de langage.
 *
 * Le procédé est celui des empreintes par n-grammes (shingling) : le texte est
 * réduit à l'ensemble de ses suites de `k` mots. Deux textes dont l'un cite
 * l'autre partagent massivement ces suites, quel que soit l'ordre des chapitres.
 */

/** Longueur des n-grammes. 5 mots : assez long pour que la coïncidence fortuite soit rare. */
export const SHINGLE_SIZE = 5;

/**
 * Réduit le texte à ses mots signifiants, sans diacritiques ni ponctuation.
 * L'apostrophe est un SÉPARATEUR : l'élision est constante en français et
 * s'écrit indifféremment « l'été », « l’été » ou « l été » selon la source.
 * La traiter comme une lettre rendrait l'empreinte sensible à ce détail
 * typographique, au point de manquer une reprise pourtant littérale.
 */
function words(text: string): string[] {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['’‘`]/g, " ")
      .match(/[a-z0-9]+/g) ?? []
  );
}

/** Ensemble des suites de `k` mots consécutifs d'un texte. */
export function shingles(text: string, k: number = SHINGLE_SIZE): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  if (w.length < k) {
    // Texte plus court qu'une empreinte : on le prend en un bloc plutôt que de
    // renvoyer un ensemble vide, qui ferait passer la comparaison pour nulle.
    if (w.length) out.add(w.join(" "));
    return out;
  }
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(" "));
  return out;
}

export interface TextOverlap {
  /** |A ∩ B| / |A ∪ B| — similarité globale, sensible à l'écart de taille. */
  jaccard: number;
  /**
   * |A ∩ B| / min(|A|, |B|) — taux de confinement. Vaut 1 quand le texte le
   * plus court est intégralement repris dans le plus long, quelle que soit la
   * différence de longueur : c'est le cas « œuvre tronquée » que le score
   * structurel seul ne peut pas voir.
   */
  containment: number;
  /** Sens du confinement, `null` si les deux textes sont de taille comparable. */
  direction: "cand_in_ref" | "ref_in_cand" | null;
  /** Nombre d'empreintes de chaque côté, pour interpréter les taux ci-dessus. */
  refShingles: number;
  candShingles: number;
}

/** Compare deux textes bruts par empreintes de n-grammes. */
export function compareTexts(refText: string, candText: string, k: number = SHINGLE_SIZE): TextOverlap {
  const a = shingles(refText, k);
  const b = shingles(candText, k);
  const empty: TextOverlap = {
    jaccard: 0,
    containment: 0,
    direction: null,
    refShingles: a.size,
    candShingles: b.size,
  };
  if (!a.size || !b.size) return empty;

  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const s of small) if (large.has(s)) inter += 1;

  const union = a.size + b.size - inter;
  return {
    jaccard: union > 0 ? inter / union : 0,
    containment: inter / small.size,
    // Le sens n'a de sens que si les tailles diffèrent nettement : sur deux
    // textes de volume comparable, parler d'inclusion serait trompeur.
    direction:
      a.size >= b.size * 1.2 ? "cand_in_ref" : b.size >= a.size * 1.2 ? "ref_in_cand" : null,
    refShingles: a.size,
    candShingles: b.size,
  };
}
