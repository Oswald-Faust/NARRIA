import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookMarked } from "lucide-react";
import { auth } from "@/auth";
import { koba } from "@/lib/fonts";
import { LandingNavbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/sections";
import { Reveal } from "@/components/landing/reveal";
import { FUNCTION_REPERTOIRE } from "@/lib/engine/repertoire";

export const metadata: Metadata = {
  title: "Les 53 fonctions narratives de NARR'IA — répertoire complet",
  description:
    "Le répertoire de référence NARR'IA : 53 fonctions narratives réparties en 7 familles, de Propp à Greimas, dont 7 fonctions propres aux traditions orales africaines. Consultable librement.",
};

/** Titre court d'une famille : « Famille 1 — Rupture initiale (…) » → « Rupture initiale ». */
function familyTitle(name: string): string {
  const afterDash = name.includes("—") ? name.split("—").slice(1).join("—") : name;
  return afterDash.replace(/\([^)]*\)/g, "").trim();
}

const families = FUNCTION_REPERTOIRE.families;
const totalFunctions = families.reduce((sum, f) => sum + f.functions.length, 0);
const africanFunctions = families
  .flatMap((f) => f.functions)
  .filter((fn) => fn.african).length;

export default async function RepertoirePublicPage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-purple/30">
      <LandingNavbar isAuthed={isAuthed} />
      <main>
        <section className="relative overflow-hidden pb-14 pt-32 sm:pt-40">
          <div
            className="lp-orb pointer-events-none absolute -top-24 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
            style={{ background: "radial-gradient(closest-side, #843b90, transparent)" }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Reveal effect="blur">
              <span className="inline-flex items-center gap-2 rounded-full border border-purple/30 bg-purple/10 px-4 py-1.5 text-xs font-semibold text-purple dark:text-soft-purple">
                <BookMarked className="h-3.5 w-3.5" />
                Répertoire de référence
              </span>
              <h1
                className={`${koba.className} mt-5 text-balance text-4xl leading-tight tracking-wide text-lp-ink sm:text-5xl`}
              >
                Les {totalFunctions} fonctions narratives
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-8 text-lp-ink/65">
                Le répertoire fermé sur lequel repose chaque analyse NARR&apos;IA : {totalFunctions} fonctions
                cardinales en {families.length} familles, héritées de Propp, Greimas et Bremond — dont{" "}
                {africanFunctions} propres aux traditions orales africaines, absentes des grilles occidentales.
              </p>
            </Reveal>
          </div>

          <div className="relative mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-3xl border border-lp-ink/10 bg-lp-ink/10">
            {[
              { value: totalFunctions, label: "fonctions" },
              { value: families.length, label: "familles" },
              { value: africanFunctions, label: "fonctions africaines" },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.1} className="bg-lp-bg">
                <div className="flex h-full flex-col items-center justify-center gap-1 px-4 py-7 text-center">
                  <span className={`${koba.className} text-3xl tracking-wide text-lp-ink sm:text-4xl`}>
                    {stat.value}
                  </span>
                  <span className="text-xs leading-4 text-lp-ink/50">{stat.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto max-w-4xl space-y-14 px-4 sm:px-6">
            {families.map((family, fi) => (
              <Reveal key={family.id} delay={fi * 0.05}>
                <div>
                  <div className="flex items-baseline gap-3">
                    <span
                      className={`${koba.className} text-lg tracking-wide text-purple dark:text-soft-purple`}
                    >
                      {family.id}
                    </span>
                    <h2 className="font-heading text-xl font-bold text-lp-ink">{familyTitle(family.name)}</h2>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-lp-ink/10">
                    {family.functions.map((fn, i) => (
                      <div
                        key={fn.code}
                        className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-5 ${
                          i > 0 ? "border-t border-lp-ink/8" : ""
                        } ${fn.african ? "bg-yellow/6" : "bg-lp-ink/2"}`}
                      >
                        <div className="flex shrink-0 items-start gap-2 sm:w-44">
                          <code className="rounded bg-lp-ink/8 px-2 py-0.5 font-mono text-[13px] font-semibold text-lp-ink/80">
                            {fn.code}
                          </code>
                          <span className="text-sm font-semibold text-lp-ink">{fn.name}</span>
                        </div>
                        <p className="text-sm leading-6 text-lp-ink/60">{fn.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="pb-24 sm:pb-32">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Reveal effect="zoom">
              <div className="rounded-3xl border border-lp-ink/10 bg-lp-ink/3 px-6 py-12">
                <h2 className={`${koba.className} text-balance text-2xl tracking-wide text-lp-ink sm:text-3xl`}>
                  Voyez ces fonctions à l&apos;œuvre sur vos textes.
                </h2>
                <Link
                  href={isAuthed ? "/analyser" : "/register"}
                  className="lp-shine mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-pink px-8 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-soft-pink"
                >
                  {isAuthed ? "Analyser une œuvre" : "Analyser gratuitement"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
