import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  PartyPopper, Clapperboard, Wand2, Swords, Popcorn, Trophy, Flame,
} from "lucide-react";
import { auth } from "@/auth";
import { koba } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { LandingNavbar } from "@/components/landing/navbar";
import { Reveal, AnimatedWords } from "@/components/landing/reveal";
import { RingGauge } from "@/components/landing/mockups";
import { Footer } from "@/components/landing/sections";

export const metadata: Metadata = {
  title: "NARR'IA pour le fun — Et si Star Wars était un conte russe ?",
  description:
    "Dissèque tes films, séries et fanfictions préférés : compare-les aux mythes, défie tes amis au score SNS, et laisse le chat spoiler la structure de tout ce qui raconte.",
};

function enter(delay: number): CSSProperties {
  return { "--d": `${delay}s` } as CSSProperties;
}

const VS_CARDS = [
  { a: "Star Wars — Un nouvel espoir", b: "Le conte du tsar Saltan", sns: 0.79, note: "le monomythe pris la main dans le sac" },
  { a: "Le Roi Lion", b: "Hamlet", sns: 0.84, note: "personne n'est surpris" },
  { a: "Ta fanfic de 80 000 mots", b: "Orgueil et Préjugés", sns: 0.61, note: "on t'a vu·e" },
];

const IDEAS = [
  {
    icon: Clapperboard,
    title: "Dissèque ta série préférée",
    desc: "Colle le synopsis de la saison et regarde le schéma actantiel révéler qui est vraiment l'opposant. Indice : ce n'est pas toujours le méchant.",
    rotate: "-rotate-1",
  },
  {
    icon: Swords,
    title: "Organise des battles SNS",
    desc: "Deux amis, deux œuvres « totalement originales », un score de similarité. Le perdant paie les popcorns.",
    rotate: "rotate-1",
  },
  {
    icon: Wand2,
    title: "Fais spoiler la structure",
    desc: "Demande au chat : « pourquoi cette intrigue fonctionne ? » Il te sort les fonctions de Propp comme d'autres sortent les cartes Pokémon.",
    rotate: "rotate-[1.5deg]",
  },
  {
    icon: Popcorn,
    title: "Teste les théories de fans",
    desc: "« Cet épisode est un remake caché du pilote » — vérifie avec un vrai score au lieu d'un thread de 40 messages.",
    rotate: "-rotate-[1.5deg]",
  },
];

const MARQUEE = [
  "Star Wars ↔ conte russe : 0,79", "Le Roi Lion ↔ Hamlet : 0,84", "Matrix ↔ mythe de la caverne : 0,72",
  "Ta fanfic ↔ Jane Austen : 0,61", "Rocky ↔ Cendrillon : 0,68",
];

export default async function FunPage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);
  const ctaHref = isAuthed ? "/accueil" : "/register";

  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-pink/40">
      <LandingNavbar isAuthed={isAuthed} />
      <main>
        {/* ── Héro ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-16 pt-36 sm:pt-44">
          <div className="lp-grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div
            className="lp-orb pointer-events-none absolute -top-24 left-[20%] h-96 w-96 rounded-full blur-[110px]"
            style={{ background: "#da3861", opacity: "calc(var(--lp-orb-opacity) * 0.8)" }}
            aria-hidden
          />
          <div
            className="lp-orb pointer-events-none absolute right-[10%] top-52 h-80 w-80 rounded-full blur-[110px]"
            style={{ background: "#f4ad5c", animationDelay: "-12s", opacity: "calc(var(--lp-orb-opacity) * 0.6)" }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="lp-enter inline-flex -rotate-2 items-center gap-2 rounded-full border border-pink/40 bg-pink/12 px-4 py-1.5 text-xs font-bold tracking-wide text-pink dark:text-soft-pink">
              <PartyPopper className="h-3.5 w-3.5" />
              NARR&apos;IA pour le fun
            </div>
            <h1 className={`${koba.className} mt-6 text-balance text-4xl leading-[1.08] tracking-wide text-lp-ink sm:text-6xl md:text-7xl`}>
              <AnimatedWords text="Et si Star Wars était" startDelay={0.15} stagger={0.1} />
              <br />
              <AnimatedWords
                text="un conte russe ?"
                startDelay={0.6}
                stagger={0.14}
                wordClassName="bg-gradient-to-r from-pink via-soft-pink to-yellow bg-clip-text text-transparent"
              />
            </h1>
            <p className="lp-enter mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-lp-ink/65 sm:text-lg" style={enter(1.05)}>
              Spoiler : à 0,79 de score SNS, oui. Films, séries, jeux, fanfictions — tout ce qui
              raconte une histoire peut passer sur la table de dissection. C&apos;est
              scientifique, et c&apos;est très amusant.
            </p>
            <div className="lp-enter mt-8 flex flex-wrap items-center justify-center gap-3" style={enter(1.2)}>
              <Link
                href={ctaHref}
                className="lp-shine inline-flex h-12 items-center gap-2 rounded-full bg-pink px-7 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(218,56,97,0.8)] transition-all hover:-translate-y-0.5 hover:scale-105 hover:bg-soft-pink"
              >
                <Flame className="h-4 w-4" />
                {isAuthed ? "Ouvrir l'app" : "Lancer ma première battle"}
              </Link>
              <a
                href="#idees"
                className="inline-flex h-12 items-center rounded-full border border-lp-ink/15 bg-lp-ink/5 px-7 text-sm font-semibold text-lp-ink/85 transition-all hover:-translate-y-0.5 hover:bg-lp-ink/10"
              >
                Idées de soirée
              </a>
            </div>
          </div>

          {/* Cartes versus */}
          <div className="relative mx-auto mt-16 grid max-w-5xl gap-5 px-4 sm:px-6 md:grid-cols-3">
            {VS_CARDS.map((v, i) => (
              <Reveal key={v.a} delay={0.15 + i * 0.12} effect="flip">
                <div
                  className={cn(
                    "group h-full rounded-3xl border border-white/10 bg-[#120a24] p-5 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.6)] transition-all duration-500 hover:z-10 hover:scale-[1.04] hover:rotate-0",
                    i === 0 && "md:-rotate-2",
                    i === 1 && "md:translate-y-3",
                    i === 2 && "md:rotate-2",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-[12.5px] font-semibold leading-5 text-white/90">
                      {v.a}
                      <div className={`${koba.className} my-1 text-sm tracking-widest text-yellow`}>VS</div>
                      {v.b}
                    </div>
                    <RingGauge value={v.sns} size={72} stroke={10} />
                  </div>
                  <div className="mt-3 border-t border-white/8 pt-2.5 text-[11px] italic text-white/45">
                    « {v.note} »
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Marquee des matchs ────────────────────────────────────────── */}
        <section className="lp-marquee relative overflow-hidden border-y border-lp-ink/8 bg-lp-ink/2 py-5">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-lp-bg to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-lp-bg to-transparent" />
          <div className="lp-marquee-track flex w-max items-center gap-8">
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <span key={i} className="flex items-center gap-8 whitespace-nowrap text-sm font-semibold text-lp-ink/45" aria-hidden={i >= MARQUEE.length}>
                <Trophy className="h-4 w-4 text-yellow" />
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* ── Idées ─────────────────────────────────────────────────────── */}
        <section id="idees" className="scroll-mt-28 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-pink dark:text-soft-pink">
                À tester ce soir
              </div>
              <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}>
                Quatre façons de gâcher un visionnage
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-lp-ink/60">
                (Ou de le rendre dix fois plus intéressant, selon le point de vue.)
              </p>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2">
              {IDEAS.map((idea, i) => (
                <Reveal key={idea.title} delay={i * 0.1} effect="zoom">
                  <div
                    className={cn(
                      "group h-full rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-7 transition-all duration-500 hover:rotate-0 hover:border-pink/40 hover:shadow-[0_24px_60px_-24px_rgba(218,56,97,0.5)]",
                      idea.rotate,
                    )}
                  >
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink to-yellow text-white shadow-lg transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                      <idea.icon className="h-5.5 w-5.5" />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-lp-ink">{idea.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-lp-ink/55">{idea.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="pb-24 sm:pb-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal effect="zoom">
              <div className="relative overflow-hidden rounded-[36px] border border-pink/25 px-6 py-16 text-center sm:py-20">
                <div className="absolute inset-0 bg-gradient-to-br from-[#2b1650] via-[#6e1d3f] to-[#a33b1e]" aria-hidden />
                <div className="lp-grain pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />
                <div className="relative">
                  <h2 className={`${koba.className} mx-auto max-w-2xl text-balance text-3xl leading-tight tracking-wide text-white sm:text-5xl`}>
                    Ton film préféré cache un conte. Trouve lequel.
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-white/70">
                    Compte gratuit, résultats en moins d&apos;une minute, fous rires non garantis
                    mais fréquents.
                  </p>
                  <Link
                    href={ctaHref}
                    className="lp-shine mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-[#6e1d3f] transition-all hover:-translate-y-0.5 hover:scale-105"
                  >
                    <PartyPopper className="h-4 w-4" />
                    {isAuthed ? "Ouvrir l'app" : "Jouer maintenant"}
                  </Link>
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
