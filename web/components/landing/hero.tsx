import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { koba } from "@/lib/fonts";
import { AnimatedWords } from "./reveal";
import { AnalysisMockup, RingGauge } from "./mockups";

function enter(delay: number): CSSProperties {
  return { "--d": `${delay}s` } as CSSProperties;
}

/** Héro de la landing : titre display KOBA animé mot à mot + mockup produit. */
export function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-36 sm:pt-44">
      {/* Ambiance : grille + orbes (opacité pilotée par thème) */}
      <div className="lp-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="lp-orb pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[820px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(closest-side, #5a2a8f 0%, #3a1d63 45%, transparent 70%)",
          opacity: "var(--lp-orb-opacity)",
        }}
        aria-hidden
      />
      <div
        className="lp-orb pointer-events-none absolute -left-32 top-64 h-72 w-72 rounded-full blur-[100px]"
        style={{ background: "#da3861", animationDelay: "-8s", opacity: "calc(var(--lp-orb-opacity) * 0.55)" }}
        aria-hidden
      />
      <div
        className="lp-orb pointer-events-none absolute -right-24 top-40 h-64 w-64 rounded-full blur-[100px]"
        style={{ background: "#f4ad5c", animationDelay: "-15s", opacity: "calc(var(--lp-orb-opacity) * 0.4)" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="lp-enter inline-flex items-center gap-2 rounded-full border border-purple/35 bg-purple/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-purple dark:border-soft-purple/35 dark:bg-soft-purple/10 dark:text-soft-purple">
            <Sparkles className="h-3.5 w-3.5" />
            Narratologie computationnelle
          </div>

          <h1
            className={`${koba.className} mt-6 text-balance text-4xl leading-[1.08] tracking-wide text-lp-ink sm:text-6xl md:text-7xl`}
          >
            <AnimatedWords text="Le vol d'intrigue" startDelay={0.15} stagger={0.12} />
            <br />
            <AnimatedWords
              text="ne passe plus inaperçu."
              startDelay={0.5}
              stagger={0.12}
              wordClassName="text-gradient-narria saturate-150 dark:brightness-150"
            />
          </h1>

          <p
            className="lp-enter mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-lp-ink/65 sm:text-lg sm:leading-8"
            style={enter(1)}
          >
            NARR&apos;IA lit la structure profonde de vos récits — fonctions narratives, schémas
            actantiels, tensions — et détecte le plagiat d&apos;intrigue là où les mots ne se
            ressemblent pas.
          </p>

          <div className="lp-enter mt-8 flex flex-wrap items-center justify-center gap-3" style={enter(1.15)}>
            <Link
              href={isAuthed ? "/accueil" : "/register"}
              className="lp-shine inline-flex h-12 items-center gap-2 rounded-full bg-pink px-7 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(218,56,97,0.7)] transition-all hover:-translate-y-0.5 hover:bg-soft-pink"
            >
              {isAuthed ? "Ouvrir l'app" : "Commencer gratuitement"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#produit"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-lp-ink/15 bg-lp-ink/5 px-7 text-sm font-semibold text-lp-ink/85 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-lp-ink/30 hover:bg-lp-ink/10"
            >
              Découvrir le produit
            </a>
          </div>

          <p className="lp-enter mt-5 text-xs text-lp-ink/40" style={enter(1.3)}>
            Score SNS explicable · 53 fonctions narratives · Rapports exportables
          </p>
        </div>

        {/* Mockup produit + cartes flottantes */}
        <div className="lp-enter relative mx-auto mt-16 max-w-5xl" style={enter(1.2)}>
          <div
            className="pointer-events-none absolute -inset-x-8 -top-10 bottom-1/3 rounded-[40px] opacity-50 blur-3xl"
            style={{ background: "linear-gradient(120deg, rgba(132,59,144,0.5), rgba(218,56,97,0.35), rgba(244,173,92,0.25))" }}
            aria-hidden
          />
          <div className="lp-hero-shot relative">
            <AnalysisMockup />
          </div>

          {/* Carte flottante : verdict */}
          <div className="lp-float absolute -left-4 top-10 hidden rounded-2xl border border-white/12 bg-[#1d1233]/90 px-4 py-3 shadow-2xl backdrop-blur-xl lg:block">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-yellow">
              <span className="lp-pulse h-2 w-2 rounded-full bg-yellow" />
              Alerte structure
            </div>
            <div className="mt-1 text-[11px] leading-4 text-white/60">
              6 fonctions sur 8 appariées
              <br />
              au-delà du seuil 0,40
            </div>
          </div>

          {/* Carte flottante : mini score */}
          <div className="lp-float-2 absolute -right-6 -bottom-8 hidden items-center gap-3 rounded-2xl border border-white/12 bg-[#1d1233]/90 px-4 py-3 shadow-2xl backdrop-blur-xl lg:flex">
            <RingGauge value={0.87} size={64} stroke={11} />
            <div>
              <div className="text-[12px] font-bold text-white">Similarité forte</div>
              <div className="text-[11px] text-white/55">Verdict en 40 secondes</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
