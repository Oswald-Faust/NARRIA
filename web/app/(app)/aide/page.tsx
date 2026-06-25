"use client";

import { useState } from "react";
import {
  Search, Rocket, ScanText, GitCompareArrows, ShieldCheck, ChevronDown, LifeBuoy,
} from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { icon: Rocket, title: "Démarrage rapide", desc: "Découvrez NARR'IA en 5 minutes : créer un compte, lancer votre première analyse." },
  { icon: ScanText, title: "Analyser un texte", desc: "Soumettez une œuvre et comprenez les résultats d'analyse structurelle narrative." },
  { icon: GitCompareArrows, title: "Comparer deux textes", desc: "Comment interpréter l'indice de similarité et les résultats de comparaison d'intrigues." },
  { icon: ShieldCheck, title: "Propriété intellectuelle", desc: "Comprendre la valeur légale des rapports NARR'IA et leur usage dans un contexte juridique." },
];

const FAQ = [
  {
    q: "NARR'IA peut-il détecter un plagiat de structure narrative entre deux œuvres de genres différents ?",
    a: "Oui. NARR'IA compare la structure narrative profonde (fonctions, actants, tension, modalités) indépendamment du genre ou du style de surface. Une transposition d'un drame en roman peut donc être détectée.",
  },
  {
    q: "Quelle est la différence entre l'indice de similarité structurelle et la similarité textuelle ?",
    a: "La similarité textuelle compare des mots et des phrases. NARR'IA compare des structures : l'enchaînement des fonctions narratives et la configuration actantielle. Deux textes sans aucun mot commun peuvent partager une même structure.",
  },
  {
    q: "Les rapports générés par NARR'IA sont-ils recevables devant un tribunal ?",
    a: "Les rapports constituent une aide à l'expertise, non une preuve juridique définitive. Ils doivent être interprétés par un narratologue et, le cas échéant, un juriste spécialisé.",
  },
  {
    q: "Comment protéger mon œuvre avant de la soumettre à l'analyse ?",
    a: "Procédez à un dépôt légal ou à un horodatage (registre, SACD, enveloppe Soleau numérique) avant toute diffusion. NARR'IA peut vous aider à constituer un registre de dépôt.",
  },
  {
    q: "Comment fonctionne le dépôt légal numérique et quel lien avec NARR'IA ?",
    a: "Le dépôt légal numérique horodate une preuve d'antériorité. NARR'IA complète cette démarche en caractérisant la singularité structurale de votre œuvre.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full rounded-xl border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-soft-pink/50"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-foreground">{q}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </div>
      {open && <p className="mt-3 text-sm text-muted">{a}</p>}
    </button>
  );
}

export default function AidePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero + recherche */}
      <section className="bg-gradient-narria rounded-[var(--radius-card)] px-8 py-9">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-white">
          Comment pouvons-nous vous aider ?
        </h1>
        <div className="relative mt-5 max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
          <input
            placeholder="Rechercher un article, une fonctionnalité…"
            className="h-12 w-full rounded-xl border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          />
        </div>
      </section>

      {/* Catégories */}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold">Parcourir par catégorie</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="cursor-pointer transition-colors hover:border-soft-pink/50">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-purple/20 text-soft-purple">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold">Questions fréquentes</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </div>
      </section>

      {/* Footer support */}
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-soft-purple/30 bg-soft-purple/10 px-6 py-5">
        <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-soft-purple" />
        <div>
          <p className="font-heading text-sm font-bold">Vous n&apos;avez pas trouvé votre réponse ?</p>
          <p className="mt-1 text-sm text-muted">
            Notre équipe est disponible pour vous accompagner. Contactez-nous via le formulaire de
            support ou rejoignez la communauté NARR&apos;IA pour échanger avec d&apos;autres
            utilisateurs et experts en narratologie.
          </p>
        </div>
      </div>
    </div>
  );
}
