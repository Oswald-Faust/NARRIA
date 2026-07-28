"use client";

/**
 * Section Tarifs de la page d'accueil — grille à quatre formules et sélecteur de
 * facturation (note « Nouvelle section Tarifs » du 27/07/2026).
 *
 * Client component : le sélecteur mensuel/annuel est interactif. Le contenu
 * provient de `lib/pricing-plans.ts` ; aucune logique de quota ni de facturation
 * n'est branchée ici — la mécanique reste à arrêter.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { koba } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { DPA_AVAILABLE } from "@/lib/legal/entity";
import {
  PRICING_FAQ,
  PRICING_PLANS,
  YEARLY_DISCOUNT_LABEL,
  formatMonthlyPrice,
  formatPriceNote,
  type BillingPeriod,
  type PricingPlan,
} from "@/lib/pricing-plans";

function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
}) {
  const options: { id: BillingPeriod; label: string }[] = [
    { id: "monthly", label: "Mensuel" },
    { id: "yearly", label: `Annuel (${YEARLY_DISCOUNT_LABEL})` },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Périodicité de facturation"
      className="mx-auto mt-10 inline-flex items-center gap-1 rounded-full border border-lp-ink/12 bg-lp-ink/4 p-1"
    >
      {options.map((option) => {
        const active = option.id === period;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition-all",
              active
                ? "bg-lp-ink text-lp-bg shadow-sm"
                : "text-lp-ink/55 hover:text-lp-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Lignes d'avantages, DPA compris seulement si le contrat est signé. */
function featuresOf(plan: PricingPlan): readonly string[] {
  if (plan.id !== "institution" || !DPA_AVAILABLE) return plan.features;
  return [...plan.features.slice(0, -1), "Engagement de confidentialité renforcé (DPA)", "Support dédié"];
}

function PlanCard({ plan, period, index }: { plan: PricingPlan; period: BillingPeriod; index: number }) {
  return (
    <Reveal delay={index * 0.08} effect={plan.popular ? "zoom" : "up"}>
      <div
        className={cn(
          "relative flex h-full flex-col rounded-3xl border p-6 transition-all duration-500 hover:-translate-y-1.5",
          plan.popular
            ? "border-pink/50 bg-gradient-to-b from-pink/12 to-purple/8 shadow-[0_30px_90px_-30px_rgba(218,56,97,0.55)]"
            : "border-lp-ink/10 bg-lp-ink/3 hover:border-lp-ink/20",
        )}
      >
        {plan.popular && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-pink px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
            Populaire
          </span>
        )}

        <h3 className="font-heading text-lg font-bold text-lp-ink">{plan.name}</h3>
        <p className="mt-1 min-h-[40px] text-[13px] leading-5 text-lp-ink/55">{plan.description}</p>

        <div className="mt-5 flex items-baseline gap-2">
          <span className={`${koba.className} text-4xl tracking-wide text-lp-ink`}>
            {formatMonthlyPrice(plan, period)}
          </span>
        </div>
        <p className="mt-1 min-h-[32px] text-xs leading-4 text-lp-ink/45">
          {formatPriceNote(plan, period)}
        </p>

        <div className="mt-4 space-y-1 border-t border-lp-ink/8 pt-4">
          <p className="text-xs font-semibold text-lp-ink/70">{plan.quota}</p>
          <p className="text-xs leading-4 text-lp-ink/45">{plan.constraint}</p>
        </div>

        <ul className="mt-5 flex-1 space-y-2.5">
          {plan.inheritsLabel && (
            <li className="text-[13px] font-semibold text-lp-ink/60">{plan.inheritsLabel}</li>
          )}
          {featuresOf(plan).map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-lp-ink/70">
              <Check
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  plan.popular ? "text-pink dark:text-soft-pink" : "text-purple dark:text-soft-purple",
                )}
              />
              {feature}
            </li>
          ))}
        </ul>

        <Link
          href={plan.cta.href}
          className={cn(
            "lp-shine mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
            plan.popular
              ? "bg-pink text-white hover:bg-soft-pink"
              : "border border-lp-ink/15 bg-lp-ink/5 text-lp-ink hover:border-lp-ink/30 hover:bg-lp-ink/10",
          )}
        >
          {plan.cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {plan.secondaryCta && (
          <a
            href={plan.secondaryCta.href}
            className="mt-3 text-center text-xs text-lp-ink/45 transition-colors hover:text-lp-ink/70"
          >
            {plan.secondaryCta.label}
          </a>
        )}
      </div>
    </Reveal>
  );
}

export function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <section id="tarifs" className="scroll-mt-28 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink dark:text-soft-pink">
            Tarifs
          </span>
          <h2
            className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-5xl`}
          >
            Des formules à la mesure de vos corpus
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-[15px] leading-7 text-lp-ink/55">
            Commencez gratuitement. Passez au niveau supérieur quand l&apos;enjeu le mérite :
            manuscrits complets, rapports exportables, travail d&apos;équipe.
          </p>
          <BillingToggle period={period} onChange={setPeriod} />
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} period={period} index={i} />
          ))}
        </div>

        {/* Renvoi vers les offres hors grille */}
        <p className="mt-10 text-center text-sm leading-7 text-lp-ink/55">
          Un litige d&apos;intrigue à instruire ? Découvrez l&apos;
          <Link href="/expertise" className="font-semibold text-pink underline-offset-4 hover:underline dark:text-soft-pink">
            offre Expertise
          </Link>
          , au dossier. Un établissement d&apos;enseignement à équiper ? Découvrez l&apos;
          <Link href="/campus" className="font-semibold text-pink underline-offset-4 hover:underline dark:text-soft-pink">
            offre Campus
          </Link>
          .
        </p>

        {/* FAQ tarifaire */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h3 className={`${koba.className} text-center text-2xl tracking-wide text-lp-ink`}>
            Questions sur les tarifs
          </h3>
          <div className="mt-8 space-y-3">
            {PRICING_FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05} effect="blur">
                <details className="lp-faq group rounded-2xl border border-lp-ink/10 bg-lp-ink/3 transition-colors open:border-purple/35 open:bg-lp-ink/5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4.5 text-[15px] font-semibold text-lp-ink/85">
                    {item.q}
                    <span className="lp-faq-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-lp-ink/15 text-lp-ink/60">
                      +
                    </span>
                  </summary>
                  <div className="px-6 pb-5 text-sm leading-7 text-lp-ink/60">
                    <p>{item.a}</p>
                    {item.link && (
                      <Link
                        href={item.link.href}
                        className="mt-2 inline-block font-semibold text-pink underline-offset-4 hover:underline dark:text-soft-pink"
                      >
                        {item.link.label}
                      </Link>
                    )}
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
