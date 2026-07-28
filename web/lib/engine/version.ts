/**
 * Version du moteur narratologique.
 *
 * Elle est publiée dans les rapports exportés et dans le bloc « Citer NARR'IA » :
 * un score n'est reproductible que si l'on sait quelle version l'a produit.
 *
 * Historique :
 * - 2.0.0 — port TypeScript du moteur Python (M1 segmentation, M2 extraction,
 *   M3 comparaison), parité stricte avec la référence Python.
 * - 2.1.0 — correctifs P0/P1/P2 de la note interne du 27/07/2026 : IDF
 *   fonctionnel, seuil de contenu, appariement injectif et couverture,
 *   normalisation SNS_N conditionnée, S_FUNC et S_TENS révisés, filtre
 *   anti-inférence identitaire, consensus d'extraction. Rompt volontairement la
 *   parité M3 avec le moteur Python.
 *
 * - 2.2.0 — retour des bêta-testeurs (août 2026). Quatre changements affectant
 *   les scores : S_FUNC aligne désormais les NŒUDS sous condition de contenu au
 *   lieu de multiplier le recouvrement par la spécificité moyenne des fonctions
 *   (la mesure violait la réflexivité : une œuvre comparée à elle-même
 *   plafonnait à 0,83) ; S_ACT ne substitue plus 0,5 à une mesure actantielle
 *   absente ; l'appariement de nœuds devient optimal (hongrois) au lieu de
 *   glouton ; une mesure de confinement, structurelle et littérale, signale
 *   qu'une œuvre est contenue dans l'autre — cas que le SNS, symétrique, ne
 *   peut pas voir.
 *
 * À incrémenter à chaque modification du calcul des scores.
 */
export const ENGINE_VERSION = "2.2.0";

/** Paramètres du modèle publiés avec les rapports, pour la section « méthode ». */
export const ENGINE_PARAMETERS = {
  matchThreshold: 0.4,
  contentThreshold: 0.1,
  weightProfile: "v1",
  /** Confinement : part de l'œuvre courte expliquée par l'autre. */
  inclusionStructuralThreshold: 0.8,
  /** Confinement littéral : recouvrement des suites de 5 mots. */
  inclusionTextualThreshold: 0.5,
} as const;
