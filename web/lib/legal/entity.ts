/**
 * Mentions factuelles des pages légales — source de vérité unique.
 *
 * ⚠️ AVERTISSEMENT — RELECTURE JURIDIQUE ENCORE REQUISE
 *
 * Les textes des pages /mentions-legales, /confidentialite et /cgu sont des
 * projets rédactionnels destinés à être relus et validés par un juriste
 * qualifié avant toute communication publique (clauses de responsabilité,
 * rétractation, droit applicable, RGPD). Ils ne constituent pas un conseil
 * juridique.
 *
 * ── HYPOTHÈSES POSÉES LE 28/07/2026, À CONFIRMER ────────────────────────────
 *
 * Les valeurs suivantes n'ont pas été fournies : elles ont été arrêtées par
 * défaut pour que le site ne comporte plus de mention manquante. Chacune est
 * signalée en commentaire au point où elle apparaît. À vérifier avant d'engager
 * quoi que ce soit sur leur fondement :
 *
 *   1. Droit applicable et juridiction compétente (droit béninois / Cotonou) —
 *      déduits du prestataire de paiement FedaPay, établi au Bénin. Dépendent en
 *      réalité du lieu d'établissement de l'Éditeur.
 *   2. Localisation des données des sous-traitants (régions d'hébergement).
 *   3. Durées de conservation et âge minimum : propositions du document source,
 *      actées ici comme décisions.
 *   4. L'Éditeur (Faust Oswald) et le Responsable du traitement (David Adékambi)
 *      sont deux personnes distinctes. Ce montage doit être formalisé : sans
 *      contrat entre eux, la répartition des responsabilités RGPD est incertaine.
 *   5. Hébergement Cloudflare : le dépôt contient par ailleurs une intégration
 *      Vercel Blob (pièces jointes de projet) et une configuration de
 *      déploiement Vercel. Vercel est donc listé comme sous-traitant.
 *
 * Trois mentions restent volontairement à compléter (forme juridique,
 * immatriculation, adresse du siège) : ce sont des faits opposables qui ne
 * peuvent pas être supposés. Elles s'affichent en surbrillance sur le site.
 *
 * Checklist de mise en ligne : voir `docs/checklist-juridique.md`.
 */

/** Marqueur d'une valeur factuelle encore inconnue, visible telle quelle à l'écran. */
export const TO_COMPLETE = (what: string) => `[À COMPLÉTER : ${what}]` as const;

export const LEGAL_ENTITY = {
  /** Éditeur du site et de la plateforme. */
  denomination: "Faust Oswald",
  /** Site professionnel de l'éditeur. */
  website: "faustoswald.com",
  /** Forme juridique — fait opposable, non supposable. */
  legalForm: TO_COMPLETE("forme juridique"),
  /** Immatriculation — fait opposable, non supposable. */
  registration: TO_COMPLETE("immatriculation"),
  /** Siège — fait opposable, non supposable. */
  address: TO_COMPLETE("adresse du siège"),
  publicationDirector: "David Adékambi",
} as const;

/**
 * Hébergement du site et du nom de domaine.
 * Le stockage des pièces jointes passe par Vercel Blob : voir LEGAL_SUBPROCESSORS.
 */
export const LEGAL_HOSTING = {
  name: "Cloudflare, Inc.",
  contact: "101 Townsend St, San Francisco, CA 94107, États-Unis — cloudflare.com",
  domain: "Nom de domaine narria.tech enregistré et géré chez Cloudflare",
} as const;

/**
 * Sous-traitants réels, relevés dans le code de la plateforme.
 * Les localisations marquées « hypothèse » restent à confirmer auprès de chaque
 * fournisseur, la région d'hébergement étant un paramètre de configuration.
 */
export const LEGAL_SUBPROCESSORS = [
  {
    name: "Cloudflare, Inc.",
    role: "Hébergement du site, réseau de diffusion et nom de domaine",
    location: "Réseau mondial (États-Unis, Union européenne)",
  },
  {
    name: "Anthropic PBC",
    role: "Extraction narrative par modèle de langue",
    location: "États-Unis",
  },
  {
    name: "MongoDB, Inc. (Atlas)",
    role: "Base de données : comptes, œuvres, analyses et rapports",
    // Hypothèse : région européenne. À confirmer dans la console Atlas.
    location: "Union européenne (Irlande)",
  },
  {
    name: "Vercel Inc.",
    role: "Stockage des pièces jointes déposées dans les projets",
    location: "Union européenne (Francfort)",
  },
  {
    name: "FedaPay",
    role: "Paiements des formules payantes",
    location: "Bénin",
  },
  {
    name: "Brevo (Sendinblue SAS)",
    role: "E-mails transactionnels : vérification de compte, notifications",
    location: "Union européenne (France)",
  },
  {
    name: "Voyage AI",
    role: "Calcul des vecteurs sémantiques, lorsque la fonctionnalité est activée",
    location: "États-Unis",
  },
] as const;

/** Durées de conservation — propositions du document source, actées. */
export const RETENTION = {
  accountAfterClosure: "30 jours",
  backupsPurge: "30 jours",
  technicalLogs: "12 mois",
} as const;

/** Âge minimum d'accès au Service. */
export const MINIMUM_AGE = { value: 16 } as const;

/**
 * Droit applicable et juridiction.
 * HYPOTHÈSE : déduits de l'établissement du prestataire de paiement (FedaPay,
 * Bénin). À rectifier selon le lieu d'établissement réel de l'Éditeur.
 */
export const GOVERNING_LAW = {
  law: "béninois",
  jurisdiction: "Cotonou (République du Bénin)",
} as const;

/** Adresse de contact pour l'exercice des droits sur les données. */
export const PRIVACY_CONTACT = "contact@narria.tech";
export const CONTACT_EMAIL = "contact@narria.tech";

/** Date de dernière mise à jour affichée en tête des pages Confidentialité et CGU. */
export const LEGAL_LAST_UPDATED = "28 juillet 2026";

/** Responsable du traitement au sens du RGPD. */
export const DATA_CONTROLLER = "David Adékambi";

/**
 * Vrai tant qu'une mention factuelle reste à compléter — les trois mentions
 * d'identité de l'Éditeur, à ce stade.
 */
export function hasUnresolvedLegalPlaceholders(): boolean {
  return [LEGAL_ENTITY.legalForm, LEGAL_ENTITY.registration, LEGAL_ENTITY.address].some((v) =>
    v.startsWith("[À COMPLÉTER"),
  );
}

/**
 * Le DPA (Data Processing Agreement) est-il signé et opposable ?
 * Tant que ce n'est pas le cas, la ligne « Engagement de confidentialité
 * renforcé (DPA) » ne doit PAS figurer sur la carte Institution — c'est une
 * promesse contractuelle, pas un argument de vente.
 */
export const DPA_AVAILABLE = false;
