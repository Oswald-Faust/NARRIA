/**
 * Gabarit des pages légales (mentions légales, confidentialité, CGU).
 *
 * Registre volontairement sobre : contrairement aux pages produit, ces pages
 * doivent se lire, se citer et s'imprimer. Pas d'animation d'entrée, pas
 * d'orbes, une colonne unique et une hiérarchie typographique stable.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/sections";

const LEGAL_PAGES = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cgu", label: "CGU" },
] as const;

export function LegalPage({
  title,
  lastUpdated,
  isAuthed,
  currentPath,
  children,
}: {
  title: string;
  lastUpdated?: string;
  isAuthed: boolean;
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-pink/40 selection:text-lp-ink">
      <LandingNavbar isAuthed={isAuthed} />
      <main className="pb-20 pt-28 sm:pb-28 sm:pt-36">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight text-lp-ink sm:text-4xl">
            {title}
          </h1>
          {lastUpdated ? (
            <p className="mt-3 text-sm text-lp-ink/50">Dernière mise à jour : {lastUpdated}</p>
          ) : null}

          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Pages légales">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                aria-current={page.href === currentPath ? "page" : undefined}
                className={
                  page.href === currentPath
                    ? "rounded-full border border-purple/40 bg-purple/10 px-4 py-1.5 text-xs font-semibold text-purple dark:text-soft-purple"
                    : "rounded-full border border-lp-ink/12 px-4 py-1.5 text-xs font-semibold text-lp-ink/55 transition-colors hover:border-lp-ink/25 hover:text-lp-ink"
                }
              >
                {page.label}
              </Link>
            ))}
          </nav>

          <div className="legal-prose mt-12">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Titre de section (niveau 2) des pages légales. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-heading text-xl font-bold text-lp-ink">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Sous-titre (niveau 3). */
export function LegalSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-7">
      <h3 className="font-heading text-base font-bold text-lp-ink">{title}</h3>
      <div className="mt-2.5 space-y-3">{children}</div>
    </div>
  );
}

/** Paragraphe courant. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-7 text-lp-ink/70">{children}</p>;
}

/** Liste à puces. */
export function UL({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-2 text-[15px] leading-7 text-lp-ink/70">{children}</ul>;
}

/**
 * Mention factuelle encore à compléter. Rendue visible et signalée : une page
 * légale incomplète doit se voir au premier coup d'œil, y compris en relecture.
 */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-yellow/20 px-1.5 py-0.5 font-mono text-[0.85em] text-[#8a5a10] dark:text-yellow">
      {children}
    </span>
  );
}
