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
 * À incrémenter à chaque modification du calcul des scores.
 */
export const ENGINE_VERSION = "2.1.0";

/** Paramètres du modèle publiés avec les rapports, pour la section « méthode ». */
export const ENGINE_PARAMETERS = {
  matchThreshold: 0.4,
  contentThreshold: 0.1,
  weightProfile: "v1",
} as const;
