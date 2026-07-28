/**
 * Gabarit des pages d'offre hors grille (/expertise, /campus).
 *
 * Même registre visuel que les pages produit — hero avec orbes, cartes en
 * grille, encadré de cadrage, CTA de clôture — mais structuré autour d'un
 * contact commercial plutôt que d'une inscription en libre-service.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LandingNavbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/sections";
import { Reveal } from "@/components/landing/reveal";
import { koba } from "@/lib/fonts";

export interface OfferCard {
  title: string;
  desc: string;
  icon: React.ElementType;
}

export interface OfferStep {
  n: string;
  title: string;
  desc: string;
}

export function OfferHero({
  kicker,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  reassurance,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  reassurance: string;
}) {
  return (
    <section className="relative pb-16 pt-28 sm:pb-24 sm:pt-36">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="lp-orb absolute -top-24 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]"
          style={{ background: "radial-gradient(closest-side, #843b90, transparent)" }}
          aria-hidden
        />
        <div
          className="lp-orb absolute -right-32 top-1/3 h-80 w-[450px] rounded-full opacity-25 blur-[100px]"
          style={{ background: "radial-gradient(closest-side, #da3861, transparent)" }}
          aria-hidden
        />
      </div>
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal effect="blur">
          <span className="inline-flex items-center gap-2 rounded-full border border-purple/30 bg-purple/10 px-4 py-1.5 text-xs font-semibold text-purple dark:text-soft-purple">
            {kicker}
          </span>
          <h1
            className={`${koba.className} mt-5 text-balance text-4xl leading-tight tracking-wide text-lp-ink sm:text-6xl`}
          >
            {title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-8 text-lp-ink/65 sm:text-lg">
            {subtitle}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={primaryCta.href}
              className="lp-shine inline-flex h-12 items-center gap-2 rounded-full bg-pink px-8 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(218,56,97,0.8)] transition-all hover:-translate-y-0.5 hover:bg-soft-pink"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href={secondaryCta.href}
              className="inline-flex h-12 items-center rounded-full border border-lp-ink/15 bg-lp-ink/5 px-8 text-sm font-semibold text-lp-ink/80 transition-all hover:-translate-y-0.5 hover:bg-lp-ink/10"
            >
              {secondaryCta.label}
            </Link>
          </div>
          <p className="mt-6 text-sm text-lp-ink/45">{reassurance}</p>
        </Reveal>
      </div>
    </section>
  );
}

export function OfferSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          {eyebrow && (
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-purple dark:text-soft-purple">
              {eyebrow}
            </div>
          )}
          <h2
            className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}
          >
            {title}
          </h2>
        </Reveal>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

export function OfferCards({ cards }: { cards: readonly OfferCard[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {cards.map((card, i) => (
        <Reveal key={card.title} delay={i * 0.1} effect="up">
          <div className="group h-full rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-pink/35 hover:bg-lp-ink/5">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-purple/12 text-purple transition-colors duration-500 group-hover:bg-pink/20 group-hover:text-pink dark:bg-soft-purple/15 dark:text-soft-purple dark:group-hover:text-soft-pink">
              <card.icon className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-base font-bold text-lp-ink">{card.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-lp-ink/55">{card.desc}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Liste de ce que comprend le forfait / la licence. */
export function OfferChecklist({ items }: { items: readonly string[] }) {
  return (
    <ul className="mx-auto max-w-3xl space-y-3.5">
      {items.map((item, i) => (
        <Reveal key={item} delay={i * 0.06} effect="up">
          <li className="flex items-start gap-3 rounded-2xl border border-lp-ink/10 bg-lp-ink/3 px-5 py-4 text-[15px] leading-7 text-lp-ink/70">
            <Check className="mt-1 h-4.5 w-4.5 shrink-0 text-purple dark:text-soft-purple" />
            {item}
          </li>
        </Reveal>
      ))}
    </ul>
  );
}

export function OfferSteps({ steps }: { steps: readonly OfferStep[] }) {
  return (
    <div className="relative grid gap-6 md:grid-cols-3">
      <div
        className="pointer-events-none absolute left-[16%] right-[16%] top-10 hidden border-t border-dashed border-lp-ink/15 md:block"
        aria-hidden
      />
      {steps.map((step, i) => (
        <Reveal key={step.n} delay={i * 0.15} effect="up">
          <div className="group relative h-full rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-purple/40">
            <div className="relative z-10 mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink font-heading text-lg font-bold text-white shadow-lg shadow-pink/25">
              {step.n}
            </div>
            <h3 className="font-heading text-lg font-bold text-lp-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-lp-ink/55">{step.desc}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Encadré sobre de cadrage — portée des résultats, limites. */
export function OfferFrame({ children }: { children: ReactNode }) {
  return (
    <section className="py-6">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal effect="blur">
          <div className="rounded-3xl border border-yellow/30 bg-yellow/8 p-6 text-[15px] leading-7 text-lp-ink/70">
            {children}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function OfferClosingCta({
  title,
  cta,
}: {
  title: string;
  cta: { label: string; href: string };
}) {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal effect="zoom">
          <div className="relative overflow-hidden rounded-[36px] border border-white/10 px-6 py-16 text-center sm:py-20">
            <div className="absolute inset-0 bg-gradient-narria" aria-hidden />
            <div className="lp-grain pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden />
            <div className="relative">
              <h2
                className={`${koba.className} mx-auto max-w-2xl text-balance text-3xl leading-tight tracking-wide text-white sm:text-4xl`}
              >
                {title}
              </h2>
              <a
                href={cta.href}
                className="lp-shine mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-lp-ink transition-all hover:-translate-y-0.5"
              >
                {cta.label}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Enveloppe complète d'une page d'offre. */
export function OfferPage({ isAuthed, children }: { isAuthed: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-pink/40 selection:text-lp-ink">
      <LandingNavbar isAuthed={isAuthed} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
