import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight, GraduationCap, NotebookPen, Drama, MessagesSquare,
  ShieldCheck, Clock3, BookOpenCheck, Sparkles,
} from "lucide-react";
import { auth } from "@/auth";
import { koba } from "@/lib/fonts";
import { LandingNavbar } from "@/components/landing/navbar";
import { Reveal, AnimatedWords } from "@/components/landing/reveal";
import { ChatMockup } from "@/components/landing/mockups";
import { Footer } from "@/components/landing/sections";

export const metadata: Metadata = {
  title: "NARR'IA pour les étudiants — Comprends enfin ce que le récit fabrique",
  description:
    "Fiches de lecture express, schémas actantiels prêts à coller dans ta dissertation, révisions de Propp et Greimas en discutant avec une IA. Gratuit pour commencer.",
};

function enter(delay: number): CSSProperties {
  return { "--d": `${delay}s` } as CSSProperties;
}

/* ── Carte « fiche de lecture » (mockup propre à cette page) ──────────── */
function FicheMockup() {
  return (
    <div className="rotate-1 rounded-2xl border border-white/10 bg-[#120a24] p-5 shadow-[0_40px_100px_-24px_rgba(0,0,0,0.6)] transition-transform duration-500 hover:rotate-0">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow">Fiche de lecture</div>
        <span className="rounded-full bg-yellow/15 px-2 py-0.5 text-[10px] font-bold text-yellow">généré en 38 s</span>
      </div>
      <div className="mt-2 font-heading text-[15px] font-bold text-white">Le Rouge et le Noir — Stendhal</div>
      <div className="mt-3 space-y-2 text-[12px] leading-5 text-white/70">
        <p>
          <strong className="text-soft-pink">Sujet :</strong> Julien Sorel ·{" "}
          <strong className="text-soft-pink">Objet :</strong> l&apos;ascension sociale
        </p>
        <p>
          <strong className="text-soft-purple">Opposants :</strong> la naissance, M. de Rênal, le tribunal
        </p>
        <p>
          <strong className="text-yellow">Fonctions clés :</strong> FN1 situation initiale → FN8 transgression →
          FN12 épreuve → FN30 châtiment
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["Ambition", "Hypocrisie sociale", "Passion", "Chute"].map((t) => (
          <span key={t} className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/65">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

const USE_CASES = [
  {
    icon: NotebookPen,
    title: "Fiches de lecture express",
    desc: "Dépose l'œuvre au programme : genre, actants, fonctions, thèmes — l'essentiel structuré en quelques minutes, pas la veille à 2 h du matin.",
    effect: "left" as const,
  },
  {
    icon: Drama,
    title: "Le schéma actantiel, déjà tracé",
    desc: "Sujet, objet, adjuvants, opposants : le diagramme est généré et exportable, prêt à appuyer ton commentaire composé.",
    effect: "up" as const,
  },
  {
    icon: MessagesSquare,
    title: "Réviser en discutant",
    desc: "Propp, Greimas, Bremond : pose tes questions au chat, il répond avec les concepts appliqués à TON texte, pas des définitions hors-sol.",
    effect: "up" as const,
  },
  {
    icon: ShieldCheck,
    title: "Écrire sans copier sans le savoir",
    desc: "Ta nouvelle pour le concours ressemble trop à ta série préférée ? Compare-les et corrige la structure avant de rendre.",
    effect: "right" as const,
  },
];

const TIMELINE = [
  { time: "J-7", text: "Tu déposes les trois œuvres du corpus. NARR'IA en tire les fiches et les schémas." },
  { time: "J-2", text: "Tu révises en interrogeant le chat : « pourquoi FN8 est-elle le pivot du récit ? »" },
  { time: "Jour J", text: "Tu cites le schéma actantiel et la courbe de tension. Le correcteur hausse un sourcil — le bon." },
];

export default async function EtudiantsPage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);
  const ctaHref = isAuthed ? "/accueil" : "/register";

  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-yellow/40">
      <LandingNavbar isAuthed={isAuthed} />
      <main>
        {/* ── Héro ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-16 pt-36 sm:pt-44">
          <div className="lp-grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div
            className="lp-orb pointer-events-none absolute -top-32 right-[10%] h-96 w-96 rounded-full blur-[110px]"
            style={{ background: "#f4ad5c", opacity: "calc(var(--lp-orb-opacity) * 0.7)" }}
            aria-hidden
          />
          <div
            className="lp-orb pointer-events-none absolute left-[5%] top-64 h-72 w-72 rounded-full blur-[110px]"
            style={{ background: "#da3861", animationDelay: "-10s", opacity: "calc(var(--lp-orb-opacity) * 0.5)" }}
            aria-hidden
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="lp-enter inline-flex items-center gap-2 rounded-full border border-yellow/45 bg-yellow/12 px-4 py-1.5 text-xs font-bold tracking-wide text-[#8a5a10] dark:text-yellow">
                <GraduationCap className="h-3.5 w-3.5" />
                NARR&apos;IA pour les étudiants
              </div>
              <h1 className={`${koba.className} mt-6 text-balance text-4xl leading-[1.1] tracking-wide text-lp-ink sm:text-5xl md:text-6xl`}>
                <AnimatedWords text="Comprends enfin ce que" startDelay={0.15} stagger={0.09} />
                <br />
                <AnimatedWords
                  text="le récit fabrique."
                  startDelay={0.65}
                  stagger={0.12}
                  wordClassName="bg-gradient-to-r from-yellow to-pink bg-clip-text text-transparent"
                />
              </h1>
              <p className="lp-enter mt-6 max-w-xl text-pretty text-base leading-7 text-lp-ink/65 sm:text-lg" style={enter(1)}>
                Fiches de lecture, schémas actantiels, fonctions narratives : NARR&apos;IA fait le
                travail d&apos;analyse structurale — toi, tu gardes l&apos;interprétation, la
                copie et les points.
              </p>
              <div className="lp-enter mt-8 flex flex-wrap gap-3" style={enter(1.15)}>
                <Link
                  href={ctaHref}
                  className="lp-shine inline-flex h-12 items-center gap-2 rounded-full bg-pink px-7 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(218,56,97,0.7)] transition-all hover:-translate-y-0.5 hover:bg-soft-pink"
                >
                  {isAuthed ? "Ouvrir l'app" : "C'est gratuit, fonce"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#usages"
                  className="inline-flex h-12 items-center rounded-full border border-lp-ink/15 bg-lp-ink/5 px-7 text-sm font-semibold text-lp-ink/85 transition-all hover:-translate-y-0.5 hover:bg-lp-ink/10"
                >
                  Voir les usages
                </a>
              </div>
              <p className="lp-enter mt-5 text-xs text-lp-ink/40" style={enter(1.3)}>
                Aucune carte bancaire · 20 analyses gratuites par jour
              </p>
            </div>

            {/* Mockups empilés */}
            <div className="lp-enter relative" style={enter(0.9)}>
              <FicheMockup />
              <div className="lp-float absolute -bottom-10 -left-6 hidden w-72 -rotate-2 rounded-2xl border border-white/12 bg-[#1d1233]/95 p-4 shadow-2xl backdrop-blur-xl sm:block">
                <ChatMockup />
              </div>
              <div className="lp-float-2 absolute -right-3 -top-6 rotate-3 rounded-2xl border border-yellow/30 bg-yellow/90 px-4 py-2.5 font-heading text-[13px] font-bold text-[#3a2405] shadow-xl">
                Exposé sauvé ✓
              </div>
            </div>
          </div>
        </section>

        {/* ── Usages ────────────────────────────────────────────────────── */}
        <section id="usages" className="scroll-mt-28 border-t border-lp-ink/8 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#8a5a10] dark:text-yellow">
                Au quotidien
              </div>
              <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}>
                Quatre réflexes qui changent un semestre
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2">
              {USE_CASES.map((u, i) => (
                <Reveal key={u.title} delay={i * 0.1} effect={u.effect}>
                  <div className="group h-full rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-yellow/50 hover:shadow-[0_24px_60px_-24px_rgba(244,173,92,0.5)]">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow to-pink text-white shadow-lg transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                      <u.icon className="h-5.5 w-5.5" />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-lp-ink">{u.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-lp-ink/55">{u.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Chronologie « la semaine du partiel » ─────────────────────── */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#8a5a10] dark:text-yellow">
                Scénario vécu
              </div>
              <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}>
                La semaine du partiel de littérature
              </h2>
            </Reveal>
            <div className="relative mt-14 space-y-8 border-l-2 border-dashed border-lp-ink/15 pl-8">
              {TIMELINE.map((t, i) => (
                <Reveal key={t.time} delay={i * 0.15} effect="left">
                  <div className="relative">
                    <span className="absolute -left-[42px] flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-yellow to-pink text-[10px] font-bold text-white shadow-md">
                      <Clock3 className="h-3.5 w-3.5" />
                    </span>
                    <div className={`${koba.className} text-sm tracking-widest text-pink`}>{t.time}</div>
                    <p className="mt-1 text-[15px] leading-7 text-lp-ink/70">{t.text}</p>
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
              <div className="relative overflow-hidden rounded-[36px] border border-yellow/25 px-6 py-16 text-center sm:py-20">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3a1d63] via-[#5a2a3f] to-[#8a5a10]" aria-hidden />
                <div className="lp-grain pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />
                <div className="relative">
                  <BookOpenCheck className="mx-auto h-10 w-10 text-yellow" />
                  <h2 className={`${koba.className} mx-auto mt-5 max-w-2xl text-balance text-3xl leading-tight tracking-wide text-white sm:text-4xl`}>
                    Ta prochaine fiche de lecture se rédige toute seule.
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-white/70">
                    Compte gratuit, 20 analyses par jour. Largement de quoi finir le semestre.
                  </p>
                  <Link
                    href={ctaHref}
                    className="lp-shine mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-yellow px-8 text-sm font-bold text-[#3a2405] transition-all hover:-translate-y-0.5 hover:brightness-110"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isAuthed ? "Ouvrir l'app" : "Créer mon compte étudiant"}
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
