"use client";

import { ShieldCheck, BookOpen, Workflow } from "lucide-react";
import { LogoEmblem } from "@/components/brand/logo";
import { koba } from "@/lib/fonts";

const SUGGESTIONS = [
  {
    icon: ShieldCheck,
    title: "Protection & Propriété Intellectuelle",
    prompt:
      "Comment protéger mon univers narratif contre le plagiat avant de publier ?",
  },
  {
    icon: BookOpen,
    title: "Protection de votre intrigue",
    prompt:
      "Quels éléments de mon univers fantasy sont protégeables en tant que propriété intellectuelle ?",
  },
  {
    icon: Workflow,
    title: "Renforcer votre structure",
    prompt:
      "Mon acte II manque de tension — comment restructurer mes points de basculement narratifs ?",
  },
];

/** Écran d'accueil du chat (conversation vide) — emblème + suggestions. */
export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-8">
      <div className="relative mb-6 flex items-center justify-center">
        <div className="absolute h-40 w-40 rounded-full bg-soft-purple/20 blur-3xl" />
        <LogoEmblem className="relative h-24 w-24 drop-shadow-xl" />
      </div>

      <h1 className={`${koba.className} text-center text-2xl font-semibold tracking-wide text-foreground sm:text-3xl`}>
        Votre Expert conversationnel en Narratologie et Littérature
      </h1>
      <p className="mt-3 max-w-xl text-center text-sm text-muted">
        Posez votre question sur la création littéraire, l&apos;univers des œuvres
        ou la protection de vos droits.
      </p>

      <div className="mt-8 grid w-full gap-4 sm:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
          <button
            key={title}
            onClick={() => onPick(prompt)}
            className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition-colors hover:border-soft-pink"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-soft-purple/20 text-soft-purple">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs leading-5 text-muted">« {prompt} »</p>
          </button>
        ))}
      </div>
    </div>
  );
}
