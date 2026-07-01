export const SUBSCRIPTION_PLANS = {
  starter: {
    id: "starter",
    label: "Starter",
    tagline: "Pour démarrer et structurer ses premiers projets.",
    quotaDaily: 20,
    quotaMonthly: 200,
    features: [
      "Analyses essentielles",
      "Comparaisons de base",
      "Historique standard",
      "Support par email",
    ],
  },
  pro: {
    id: "pro",
    label: "Pro",
    tagline: "Pour les auteurs et équipes éditoriales en production.",
    quotaDaily: 120,
    quotaMonthly: 2000,
    features: [
      "Analyses avancées",
      "Comparaisons prioritaires",
      "Historique étendu",
      "Support prioritaire",
      "Accès API",
    ],
  },
  enterprise: {
    id: "enterprise",
    label: "Entreprise",
    tagline: "Pour les structures multi-utilisateurs avec gouvernance.",
    quotaDaily: 1000,
    quotaMonthly: 20000,
    features: [
      "Utilisateurs multiples",
      "Quotas élevés",
      "Administration avancée",
      "Support dédié",
      "Accès API étendu",
    ],
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;
export type StoredPlanId = SubscriptionPlanId | "free";

export function normalizePlan(plan?: string | null): SubscriptionPlanId {
  if (plan === "starter" || plan === "pro" || plan === "enterprise") return plan;
  return "starter";
}

export function getPlanMeta(plan?: string | null) {
  return SUBSCRIPTION_PLANS[normalizePlan(plan)];
}
