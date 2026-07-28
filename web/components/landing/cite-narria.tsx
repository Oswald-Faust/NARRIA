"use client";

/**
 * Bloc « Citer NARR'IA » (correctif n° 14) — page /produit/recherche.
 *
 * Un outil que des chercheurs utilisent doit dire comment on le cite, avec la
 * version du moteur qui a produit les scores : sans elle, la référence n'est pas
 * reproductible. `{VERSION}` et `{DATE}` sont injectés à l'affichage, jamais figés.
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { koba } from "@/lib/fonts";
import { ENGINE_VERSION } from "@/lib/engine/version";

function todayInFrench(): string {
  return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Presse-papiers indisponible (contexte non sécurisé, permission refusée) :
          // le texte reste sélectionnable à la main, inutile d'alerter.
        }
      }}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-lp-ink/15 bg-lp-ink/5 px-3.5 py-1.5 text-xs font-semibold text-lp-ink/70 transition-colors hover:border-lp-ink/30 hover:text-lp-ink"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-purple dark:text-soft-purple" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

export function CiteNarria() {
  const date = todayInFrench();

  const reference = `Adékambi, A. D. (2026). NARR'IA : plateforme de narratologie computationnelle (version ${ENGINE_VERSION}) [logiciel en ligne]. https://narria.tech. Consulté le ${date}.`;

  const bibtex = `@software{narria,
  author  = {Adékambi, Adéchinan David},
  title   = {NARR'IA : plateforme de narratologie computationnelle},
  year    = {2026},
  version = {${ENGINE_VERSION}},
  url     = {https://narria.tech},
  note    = {Consulté le ${date}}
}`;

  return (
    <section className="border-t border-lp-ink/8 py-24 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-purple dark:text-soft-purple">
            Publication
          </div>
          <h2
            className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}
          >
            Citer NARR&apos;IA
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-lp-ink/60">
            Chaque rapport exporté mentionne la version du moteur et les paramètres du modèle. Pour citer la
            plateforme dans une publication :
          </p>
        </Reveal>

        <Reveal delay={0.1} effect="up">
          <div className="mt-10 rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-lp-ink/40">
                Référence (auteur-date)
              </span>
              <CopyButton value={reference} label="Copier la référence bibliographique" />
            </div>
            <p className="mt-4 text-[15px] leading-7 text-lp-ink/75">{reference}</p>
          </div>
        </Reveal>

        <Reveal delay={0.16} effect="up">
          <div className="mt-5 rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-lp-ink/40">BibTeX</span>
              <CopyButton value={bibtex} label="Copier l'entrée BibTeX" />
            </div>
            <pre className="mt-4 overflow-x-auto text-[13px] leading-6 text-lp-ink/75">
              <code>{bibtex}</code>
            </pre>
          </div>
        </Reveal>

        <Reveal delay={0.22}>
          <p className="mt-6 text-sm leading-7 text-lp-ink/50">
            Dans votre section méthode, indiquez la version du moteur et le seuil d&apos;appariement utilisés —
            ils figurent en dernière page de chaque rapport exporté.
          </p>
        </Reveal>

        <Reveal delay={0.28}>
          <div className="mt-10 rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-6">
            <h3 className="font-heading text-base font-bold text-lp-ink">Données et accès programmatique</h3>
            <p className="mt-2 text-sm leading-7 text-lp-ink/60">
              Les rapports s&apos;exportent en PDF, HTML et Markdown, et les scores en CSV et JSON pour vos
              analyses statistiques sur corpus. L&apos;accès API, inclus à partir de la formule Équipe, permet
              d&apos;automatiser l&apos;analyse d&apos;un corpus entier.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
