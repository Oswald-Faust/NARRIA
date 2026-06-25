import Link from "next/link";
import Image from "next/image";
import {
  ScanText, GitCompareArrows, BookMarked, ArrowRight, TriangleAlert, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { LogoEmblem } from "@/components/brand/logo";
import heroBanner from "@/assets/Hero Banner.png";

const ACTIONS = [
  {
    href: "/analyser",
    icon: ScanText,
    title: "Analyser un texte",
    desc: "Soumettez une œuvre pour détecter sa structure narrative profonde.",
    cta: "Lancer l'analyse",
    dark: false,
  },
  {
    href: "/comparer",
    icon: GitCompareArrows,
    title: "Comparer deux textes",
    desc: "Confrontez deux œuvres et obtenez un indice de similarité narrative.",
    cta: "Comparer maintenant",
    dark: false,
  },
  {
    href: "/repertoire",
    icon: BookMarked,
    title: "Explorer le répertoire",
    desc: "Parcourez la base de données narrative de référence : schémas et structures.",
    cta: "Explorer",
    dark: true,
  },
];

export default function AccueilPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* ── Haut : bandeau de bienvenue (Hero Banner.png en fond + texte KOBA) ─ */}
      <section className="relative overflow-hidden rounded-[var(--radius-card)]">
        <Image
          src={heroBanner}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right"
        />
        {/* Voile : masque le texte incrusté à gauche, révèle le motif réseau à droite */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1b0c36] via-[#1f0e3d] via-65% to-transparent" />
        <div className="relative px-6 py-8 sm:px-9 sm:py-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" /> Narratologie computationnelle
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-wide text-white sm:text-4xl">
            Bienvenue sur NARR&apos;IA
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Détectez, quantifiez et qualifiez le vol d&apos;intrigue. NARR&apos;IA analyse la
            structure narrative profonde de vos œuvres, indépendamment de leur réalisation
            linguistique de surface.
          </p>
        </div>
      </section>

      {/* ── Milieu : emblème ──────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center py-6">
        <div className="absolute h-48 w-48 rounded-full bg-soft-purple/20 blur-3xl" />
        <LogoEmblem className="relative h-32 w-32 drop-shadow-xl" />
      </section>

      {/* ── Bas : propositions ────────────────────────────────────────── */}
      <section className="grid gap-5 md:grid-cols-3">
        {ACTIONS.map(({ href, icon: Icon, title, desc, cta, dark }) => (
          <Card
            key={href}
            className={dark ? "flex flex-col border-transparent bg-[#1a0e35] text-white" : "flex flex-col"}
          >
            <div
              className={
                dark
                  ? "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-soft-pink"
                  : "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-purple/20 text-soft-purple"
              }
            >
              <Icon className="h-6 w-6" />
            </div>
            <CardTitle className={dark ? "text-white" : ""}>{title}</CardTitle>
            <CardDescription className={dark ? "flex-1 text-white/60" : "flex-1"}>{desc}</CardDescription>
            <Link href={href} className="mt-5">
              <Button variant={dark ? "primary" : "purple"} size="sm" className="w-full">
                {cta} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        ))}
      </section>

      {/* ── Avertissement ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-soft-purple/30 bg-soft-purple/10 px-5 py-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow" />
        <p className="text-sm text-foreground/90">
          <span className="font-semibold">Avertissement important.</span> NARR&apos;IA est un
          outil d&apos;aide à l&apos;analyse narrative. Ses résultats constituent des indices, non
          des preuves légales. Toute décision juridique doit être validée par un expert qualifié.
          Les analyses ne peuvent se substituer à une expertise humaine.
        </p>
      </div>
    </div>
  );
}
