import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight, FlaskConical, Library, GitBranch, FileDown, Users2, Quote,
} from "lucide-react";
import { auth } from "@/auth";
import { koba } from "@/lib/fonts";
import { LandingNavbar } from "@/components/landing/navbar";
import { Reveal, AnimatedWords } from "@/components/landing/reveal";
import { Footer } from "@/components/landing/sections";
import { CiteNarria } from "@/components/landing/cite-narria";

export const metadata: Metadata = {
  title: "NARR'IA pour la recherche — La narratologie, enfin computationnelle",
  description:
    "Scores SNS déterministes et reproductibles, corpus comparables à l'échelle, exports citables. L'analyse structurale de Propp, Greimas et Bremond, opérationnalisée.",
};

function enter(delay: number): CSSProperties {
  return { "--d": `${delay}s` } as CSSProperties;
}

const STATS = [
  { value: "53", label: "fonctions narratives formalisées" },
  { value: "5", label: "sous-scores structurels pondérés" },
  { value: "0,40", label: "seuil d'appariement documenté" },
  { value: "10⁻⁶", label: "reproductibilité, à extraction identique" },
];

const SNS_TERMS = [
  { w: "0,25", name: "isomorphisme", desc: "similarité topologique des graphes narratifs" },
  { w: "0,20", name: "édition", desc: "distance d'édition normalisée entre graphes" },
  { w: "0,25", name: "fonctions", desc: "recouvrement des fonctions de Propp appariées" },
  { w: "0,15", name: "actants", desc: "congruence des schémas actantiels de Greimas" },
  { w: "0,15", name: "tension", desc: "corrélation des courbes de tension dramatique" },
];

const PILLARS = [
  {
    icon: Library,
    title: "Corpus à l'échelle",
    desc: "Analysez et comparez des dizaines d'œuvres — versions, traductions, variantes régionales — avec des scores strictement comparables entre eux.",
  },
  {
    icon: GitBranch,
    title: "Méthode traçable",
    desc: "Chaque score se décompose jusqu'aux fonctions appariées qui l'ont produit. Pas de boîte noire : la chaîne de calcul est inspectable.",
  },
  {
    icon: Users2,
    title: "Projets d'équipe",
    desc: "Doctorants, co-auteurs et directeurs de recherche travaillent sur le même espace, avec historique complet des analyses.",
  },
  {
    icon: FileDown,
    title: "Exports citables",
    desc: "Rapports PDF et HTML avec diagrammes, tableaux actantiels et paramètres du modèle — prêts pour l'annexe méthodologique.",
  },
];

export default async function RecherchePage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);
  const ctaHref = isAuthed ? "/accueil" : "/register";

  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-purple/30">
      <LandingNavbar isAuthed={isAuthed} />
      <main>
        {/* ── Héro ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-14 pt-36 sm:pt-44">
          <div className="lp-grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div
            className="lp-orb pointer-events-none absolute -top-24 left-[15%] h-96 w-96 rounded-full blur-[120px]"
            style={{ background: "#843b90", opacity: "calc(var(--lp-orb-opacity) * 0.7)" }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="lp-enter inline-flex items-center gap-2 rounded-full border border-purple/35 bg-purple/10 px-4 py-1.5 text-xs font-bold tracking-wide text-purple dark:border-soft-purple/35 dark:bg-soft-purple/10 dark:text-soft-purple">
              <FlaskConical className="h-3.5 w-3.5" />
              NARR&apos;IA pour la recherche
            </div>
            <h1 className={`${koba.className} mt-6 text-balance text-4xl leading-[1.1] tracking-wide text-lp-ink sm:text-5xl md:text-6xl`}>
              <AnimatedWords text="La narratologie," startDelay={0.15} stagger={0.1} />
              <br />
              <AnimatedWords
                text="enfin computationnelle."
                startDelay={0.5}
                stagger={0.12}
                wordClassName="text-gradient-narria saturate-150 dark:brightness-150"
              />
            </h1>
            <p className="lp-enter mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-lp-ink/65 sm:text-lg" style={enter(1)}>
              Les cadres de Propp, Greimas et Bremond, opérationnalisés en mesures déterministes
              sur graphes narratifs. Des résultats reproductibles, comparables et publiables.
            </p>
            <div className="lp-enter mt-8 flex flex-wrap items-center justify-center gap-3" style={enter(1.15)}>
              <Link
                href={ctaHref}
                className="lp-shine inline-flex h-12 items-center gap-2 rounded-full bg-purple px-7 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(132,59,144,0.7)] transition-all hover:-translate-y-0.5 hover:brightness-110"
              >
                {isAuthed ? "Ouvrir l'app" : "Démarrer un corpus"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#methode"
                className="inline-flex h-12 items-center rounded-full border border-lp-ink/15 bg-lp-ink/5 px-7 text-sm font-semibold text-lp-ink/85 transition-all hover:-translate-y-0.5 hover:bg-lp-ink/10"
              >
                Lire la méthode
              </a>
            </div>
          </div>

          {/* Statistiques */}
          <div className="relative mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-lp-ink/10 bg-lp-ink/10 px-0 sm:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1} className="bg-lp-bg">
                <div className="flex h-full flex-col items-center justify-center gap-1 px-4 py-7 text-center">
                  <span className={`${koba.className} text-3xl tracking-wide text-lp-ink sm:text-4xl`}>{s.value}</span>
                  <span className="text-xs leading-4 text-lp-ink/50">{s.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Méthode : la formule ──────────────────────────────────────── */}
        <section id="methode" className="scroll-mt-28 border-t border-lp-ink/8 py-24 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Reveal className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-purple dark:text-soft-purple">
                Méthode
              </div>
              <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}>
                Une définition, pas une intuition
              </h2>
            </Reveal>

            <Reveal effect="zoom" delay={0.15}>
              <div className="mt-12 overflow-x-auto rounded-3xl border border-lp-ink/10 bg-lp-ink/3 px-6 py-8 text-center">
                <p className="whitespace-nowrap font-heading text-lg font-bold tracking-tight text-lp-ink sm:text-2xl">
                  SNS <span className="text-lp-ink/40">=</span>{" "}
                  {SNS_TERMS.map((t, i) => (
                    <span key={t.name}>
                      {i > 0 && <span className="text-lp-ink/40"> + </span>}
                      <span className="text-pink dark:text-soft-pink">{t.w}</span>
                      <span className="text-lp-ink/40">·</span>
                      <span className="text-purple dark:text-soft-purple">{t.name}</span>
                    </span>
                  ))}
                </p>
              </div>
            </Reveal>

            <ol className="mt-10 space-y-4">
              {SNS_TERMS.map((t, i) => (
                <Reveal key={t.name} delay={0.1 + i * 0.08} effect="left">
                  <li className="flex items-baseline gap-4 border-b border-lp-ink/8 pb-4">
                    <span className={`${koba.className} w-10 shrink-0 text-lg text-pink`}>{`0${i + 1}`}</span>
                    <div>
                      <span className="font-heading font-bold capitalize text-lp-ink">{t.name}</span>
                      <span className="text-lp-ink/40"> — pondération {t.w} · </span>
                      <span className="text-[15px] text-lp-ink/60">{t.desc}</span>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={0.2}>
              <div className="mt-10 flex gap-4 rounded-2xl border border-lp-ink/10 bg-lp-ink/3 p-6">
                <Quote className="h-6 w-6 shrink-0 text-purple dark:text-soft-purple" />
                <p className="text-[15px] leading-7 text-lp-ink/65">
                  À structures narratives extraites identiques, deux exécutions produisent le
                  même score à 10⁻⁶ près : les mesures de graphe sont déterministes, et
                  l&apos;extraction narrative est contrainte par un répertoire fermé de 53
                  fonctions — dont 7 spécifiques aux traditions orales africaines, hors du canon
                  proppien. La variance d&apos;extraction elle-même est mesurée et publiée dans
                  chaque rapport.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Piliers ───────────────────────────────────────────────────── */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-purple dark:text-soft-purple">
                Pour votre laboratoire
              </div>
              <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}>
                Du séminaire à la publication
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2">
              {PILLARS.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.1} effect={i % 2 === 0 ? "left" : "right"}>
                  <div className="group h-full rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-7 transition-all duration-500 hover:-translate-y-1 hover:border-purple/40 hover:shadow-[0_24px_60px_-24px_rgba(132,59,144,0.5)]">
                    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-purple/12 text-purple transition-transform duration-500 group-hover:scale-110 dark:bg-soft-purple/15 dark:text-soft-purple">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-lp-ink">{p.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-lp-ink/55">{p.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        {/* ── Citer NARR'IA (correctif n° 14) ─────────────────────────── */}
        <CiteNarria />

        <section className="pb-24 sm:pb-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal effect="zoom">
              <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-narria px-6 py-16 text-center sm:py-20">
                <div className="lp-grain pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden />
                <div className="relative">
                  <h2 className={`${koba.className} mx-auto max-w-2xl text-balance text-3xl leading-tight tracking-wide text-white sm:text-4xl`}>
                    Votre prochain article mérite des données narratives.
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-white/70">
                    Ouvrez un projet, invitez votre équipe, et confrontez vos hypothèses au corpus.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href={ctaHref}
                      className="lp-shine inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-[#2b1650] transition-all hover:-translate-y-0.5 hover:bg-white/90"
                    >
                      {isAuthed ? "Ouvrir l'app" : "Démarrer un corpus"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="mailto:contact@narria.tech"
                      className="inline-flex h-12 items-center rounded-full border border-white/20 bg-white/5 px-8 text-sm font-semibold text-white/85 transition-all hover:-translate-y-0.5 hover:bg-white/10"
                    >
                      Parler à l&apos;équipe
                    </Link>
                  </div>
                  <p className="mt-6 text-sm text-white/60">
                    Laboratoires et équipes :{" "}
                    <Link href="/#tarifs" className="font-semibold text-white underline-offset-4 hover:underline">
                      découvrez la formule Équipe
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
