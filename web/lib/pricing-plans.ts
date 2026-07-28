/**
 * Grille tarifaire publique — source de vérité de la PRÉSENTATION.
 *
 * ⚠️ Ce module décrit ce que le site annonce. Il ne pilote rien : les quotas
 * réellement appliqués, la facturation et les restrictions d'usage restent dans
 * `lib/subscriptions.ts` et le code des routes, volontairement inchangés à ce
 * stade. Les deux seront rapprochés une fois la mécanique arrêtée — d'ici là,
 * ne pas brancher ce module sur les contrôles de quota.
 *
 * Chiffres arrêtés dans la note « Nouvelle section Tarifs » du 27/07/2026 :
 * Découverte 0 €, Pro 50 €/mois, Équipe 100 €/mois, Institution 200 €/mois,
 * −20 % en facturation annuelle.
 */

export type BillingPeriod = "monthly" | "yearly";

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  /** Prix mensuel en euros ; `null` pour une formule gratuite. */
  monthlyPrice: number | null;
  /** Prix mensuel équivalent en facturation annuelle (−20 %). */
  yearlyMonthlyPrice: number | null;
  /** Montant facturé en une fois sur l'année. */
  yearlyTotal: number | null;
  /** Mention sous le prix quand la formule est gratuite. */
  freeNote?: string;
  quota: string;
  /** Contrainte de longueur ou de sièges, affichée sous le quota. */
  constraint: string;
  /** Intitulé introduisant la liste quand elle prolonge la formule précédente. */
  inheritsLabel?: string;
  features: readonly string[];
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  popular?: boolean;
}

/** Remise appliquée en facturation annuelle. */
export const YEARLY_DISCOUNT_LABEL = "−20 %";

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: "decouverte",
    name: "Découverte",
    description: "Pour explorer la structure de vos premiers récits.",
    monthlyPrice: null,
    yearlyMonthlyPrice: null,
    yearlyTotal: null,
    freeNote: "pour toujours",
    quota: "5 analyses / jour · 50 / mois",
    constraint: "Textes jusqu'à 15 000 mots · 3 œuvres longues / mois",
    features: [
      "Analyses complètes à l'écran : fonctions, actants, tension",
      "Comparaisons SNS de base",
      "Export PNG du schéma actantiel",
      "Historique 30 jours",
      "Support par e-mail",
    ],
    cta: { label: "Commencer gratuitement", href: "/register" },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Pour les auteurs, doctorants et professionnels en production.",
    monthlyPrice: 50,
    yearlyMonthlyPrice: 40,
    yearlyTotal: 480,
    quota: "300 analyses / mois",
    constraint: "Longueur de texte illimitée",
    features: [
      "Exports PDF, HTML et Markdown complets",
      "1 projet collaboratif (3 sièges)",
      "Comparaisons prioritaires",
      "Historique illimité",
      "Support prioritaire",
    ],
    cta: { label: "Passer en Pro", href: "/register" },
    popular: true,
  },
  {
    id: "equipe",
    name: "Équipe",
    description: "Pour les laboratoires, cabinets et maisons d'édition.",
    monthlyPrice: 100,
    yearlyMonthlyPrice: 80,
    yearlyTotal: 960,
    quota: "1 000 analyses / mois, mutualisées",
    constraint: "5 sièges inclus · siège supplémentaire : 15 € / mois",
    inheritsLabel: "Tout Pro, plus :",
    features: [
      "Projets collaboratifs illimités",
      "Accès API",
      "Administration d'équipe : rôles et droits",
      "Exports groupés par projet",
    ],
    cta: { label: "Créer un espace d'équipe", href: "/register" },
  },
  {
    id: "institution",
    name: "Institution",
    description: "Pour les structures qui gouvernent corpus et accès.",
    monthlyPrice: 200,
    yearlyMonthlyPrice: 160,
    yearlyTotal: 1920,
    quota: "2 500 analyses / mois, mutualisées",
    constraint: "15 sièges inclus · au-delà, nous contacter",
    inheritsLabel: "Tout Équipe, plus :",
    features: [
      "API étendue",
      "Facturation sur bon de commande",
      // La ligne « Engagement de confidentialité renforcé (DPA) » n'est ajoutée
      // qu'une fois le contrat signé — cf. DPA_AVAILABLE et docs/checklist-juridique.md.
      "Support dédié",
    ],
    cta: { label: "Souscrire", href: "/register" },
    secondaryCta: { label: "ou écrire à contact@narria.tech", href: "mailto:contact@narria.tech" },
  },
] as const;

/** Prix mensuel affiché sur la carte (« 50 € », « 0 € »). */
export function formatMonthlyPrice(plan: PricingPlan, period: BillingPeriod): string {
  if (plan.monthlyPrice === null) return "0 €";
  return `${period === "yearly" ? plan.yearlyMonthlyPrice : plan.monthlyPrice} €`;
}

/** Espace fine insécable comme séparateur de milliers, conformément à l'usage français. */
function formatEuros(amount: number): string {
  return amount.toLocaleString("fr-FR");
}

/** Mention sous le prix : cadence de facturation ou gratuité. */
export function formatPriceNote(plan: PricingPlan, period: BillingPeriod): string {
  if (plan.monthlyPrice === null) return plan.freeNote ?? "";
  if (period === "yearly") return `par mois, facturé ${formatEuros(plan.yearlyTotal ?? 0)} € par an`;
  return "par mois";
}

/** FAQ tarifaire — accordéon placé sous la grille. */
export const PRICING_FAQ: readonly {
  q: string;
  a: string;
  link?: { href: string; label: string };
}[] = [
  {
    q: "Qu'est-ce qu'une « analyse » ?",
    a: "Une analyse correspond au traitement complet d'une œuvre : extraction des fonctions narratives, du schéma actantiel et de la courbe de tension. Une comparaison SNS entre deux œuvres déjà analysées ne consomme pas d'analyse supplémentaire ; comparer une œuvre nouvelle en consomme une.",
  },
  {
    q: "Pourquoi une limite de longueur en Découverte ?",
    a: "Le plan Découverte est fait pour les textes courts — contes, nouvelles, synopsis, épisodes — et accepte en plus trois œuvres longues par mois, de quoi couvrir un corpus d'étude complet. L'analyse de manuscrits en continu relève d'un usage professionnel : c'est ce que couvrent les formules Pro et supérieures.",
  },
  {
    q: "Puis-je changer de formule ou annuler à tout moment ?",
    a: "Oui. Le passage à une formule supérieure est immédiat ; la rétrogradation ou l'annulation prend effet à la fin de la période en cours. Les formules mensuelles sont sans engagement.",
  },
  {
    q: "Que se passe-t-il si j'atteins mon quota mensuel ?",
    a: "Tout ce qui existe reste accessible : analyses, rapports, projets et historique. Seules les nouvelles analyses attendent le renouvellement du quota — ou un passage à la formule supérieure, effectif immédiatement.",
  },
  {
    q: "Les quotas Équipe et Institution sont-ils partagés ?",
    a: "Oui, ils sont mutualisés entre tous les sièges de l'espace. L'administration d'équipe permet de suivre la consommation par membre.",
  },
  {
    q: "Proposez-vous une offre pour les universités et les classes ?",
    a: "Oui — l'offre Campus équipe un établissement entier : comptes enseignants et étudiants, espaces de classe et facturation institutionnelle.",
    link: { href: "/campus", label: "Voir la page Campus" },
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    // Le paiement mobile (Orange Money, MTN MoMo) ne sera mentionné ici qu'une fois
    // l'intégration en production — cf. checklist de la note Tarifs.
    a: "Carte bancaire pour les formules en libre-service ; bon de commande et virement pour Institution, Campus et Expertise.",
  },
];
