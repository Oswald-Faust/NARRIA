"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
  Menu, X, ArrowRight, ChevronDown, Moon, Sun,
  GraduationCap, FlaskConical, PartyPopper, LayoutGrid,
} from "lucide-react";
import { LogoFull } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const PRODUCT_LINKS = [
  {
    href: "/produit/etudiants",
    icon: GraduationCap,
    label: "Étudiants",
    title: "NARR'IA pour les étudiants",
    desc: "Fiches, dissertations et schémas actantiels prêts à rendre.",
    color: "text-[#8a5a10] dark:text-yellow",
    iconClass: "bg-yellow/15 text-[#8a5a10] dark:text-yellow",
  },
  {
    href: "/produit/recherche",
    icon: FlaskConical,
    label: "Recherche",
    title: "NARR'IA pour la recherche",
    desc: "Corpus, scores reproductibles et exports citables.",
    color: "text-purple dark:text-soft-purple",
    iconClass: "bg-purple/15 text-purple dark:text-soft-purple",
  },
  {
    href: "/produit/fun",
    icon: PartyPopper,
    label: "Fun",
    title: "NARR'IA pour le fun",
    desc: "Films, séries, fanfictions : dissèque tout ce qui raconte.",
    color: "text-pink dark:text-soft-pink",
    iconClass: "bg-pink/15 text-pink dark:text-soft-pink",
  },
] as const;

const LINKS = [
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/#score", label: "Score SNS" },
  { href: "/#projets", label: "Projets" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
];

const noopSubscribe = () => () => {};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // true côté client, false au rendu serveur — évite le mismatch d'hydratation.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (
    <button
      type="button"
      aria-label="Basculer le thème clair/sombre"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lp-ink/70 transition-all hover:rotate-12 hover:bg-lp-ink/8 hover:text-lp-ink"
    >
      {mounted && resolvedTheme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

/** Barre de navigation flottante des pages marketing. */
export function LandingNavbar({ isAuthed }: { isAuthed: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 16);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Nettoie le timer de fermeture au démontage.
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openProduct = () => {
    cancelClose();
    setProductOpen(true);
  };
  // Fermeture temporisée (grâce de 140 ms) — laisse le temps de traverser
  // le pont bouton→panneau sans que le menu ne clignote.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setProductOpen(false), 140);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      {/* Progression de lecture */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 h-[2.5px] origin-left bg-gradient-to-r from-purple via-pink to-yellow transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />

      <div
        className={cn(
          "mx-auto flex max-w-5xl items-center justify-between rounded-full border px-4 py-2.5 transition-all duration-500 sm:px-6",
          scrolled || open || productOpen
            ? "border-lp-ink/10 bg-[var(--lp-nav-bg)] shadow-[0_8px_40px_rgba(10,5,25,0.25)] backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" aria-label="NARR'IA — accueil" className="shrink-0">
          <LogoFull priority className="h-7 w-auto dark:hidden" />
          <LogoFull white priority className="hidden h-7 w-auto dark:block" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {/* Produit : dropdown */}
          <div
            className="relative"
            onPointerEnter={(e) => {
              if (e.pointerType !== "touch") openProduct();
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") scheduleClose();
            }}
            onBlur={(e) => {
              // Ferme si le focus quitte entièrement le menu (navigation clavier).
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                cancelClose();
                setProductOpen(false);
              }
            }}
          >
            <button
              type="button"
              aria-expanded={productOpen}
              aria-haspopup="menu"
              onClick={() => (productOpen ? setProductOpen(false) : openProduct())}
              onFocus={openProduct}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                productOpen ? "bg-lp-ink/8 text-lp-ink" : "text-lp-ink/70 hover:bg-lp-ink/8 hover:text-lp-ink",
              )}
            >
              Produit
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", productOpen && "rotate-180")} />
            </button>

            {/* Panneau (design d'origine). Handlers portés uniquement par le
                conteneur .lp-menu — le panneau en est un descendant DOM, donc
                une seule source d'événements, pas de double-déclenchement au
                passage bouton→panneau. Le pont pt-3.5 (14 px) recouvre tout
                gap sous-pixel sous le bouton. */}
            <div
              role="menu"
              className={cn(
                "absolute left-1/2 top-full w-[380px] -translate-x-1/2 pt-3.5 transition-all duration-300",
                productOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-2 opacity-0",
              )}
            >
              <div className="overflow-hidden rounded-3xl border border-lp-ink/10 bg-[var(--lp-nav-bg)] p-2 shadow-[0_24px_80px_rgba(10,5,25,0.45)] backdrop-blur-2xl">
                {PRODUCT_LINKS.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    role="menuitem"
                    onClick={() => setProductOpen(false)}
                    className="group flex items-start gap-3.5 rounded-2xl px-3.5 py-3 transition-colors hover:bg-lp-ink/6"
                  >
                    <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lp-ink/6 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6", p.color)}>
                      <p.icon className="h-4.5 w-4.5" />
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-lp-ink">
                        {p.title}
                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-70" />
                      </span>
                      <span className="mt-0.5 block text-xs leading-4.5 text-lp-ink/55">{p.desc}</span>
                    </span>
                  </Link>
                ))}
                <div className="mx-2 my-1.5 border-t border-lp-ink/8" />
                <Link
                  href="/#produit"
                  role="menuitem"
                  onClick={() => setProductOpen(false)}
                  className="group flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 transition-colors hover:bg-lp-ink/6"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lp-ink/6 text-lp-ink/70">
                    <LayoutGrid className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-semibold text-lp-ink">Vue d&apos;ensemble de la suite</span>
                </Link>
              </div>
            </div>
          </div>

          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-lp-ink/70 transition-colors hover:bg-lp-ink/8 hover:text-lp-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          <ThemeToggle />
          {isAuthed ? (
            <Link
              href="/accueil"
              className="lp-shine inline-flex h-9 items-center gap-1.5 rounded-full bg-pink px-4 text-sm font-semibold text-white transition-colors hover:bg-soft-pink"
            >
              Ouvrir l&apos;app <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-lp-ink/70 transition-colors hover:text-lp-ink"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                className="lp-shine inline-flex h-9 items-center gap-1.5 rounded-full bg-pink px-4 text-sm font-semibold text-white transition-colors hover:bg-soft-pink"
              >
                Commencer <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lp-ink/80 transition-colors hover:bg-lp-ink/10"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="mx-auto mt-2 max-w-5xl rounded-3xl border border-lp-ink/10 bg-[var(--lp-nav-bg)] p-4 shadow-2xl backdrop-blur-xl md:hidden">
          <div className="mb-1 px-3 pt-1 text-[11px] font-bold uppercase tracking-widest text-lp-ink/40">
            Produit
          </div>
          {PRODUCT_LINKS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-lp-ink/6"
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", p.iconClass)}>
                <p.icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-medium text-lp-ink/85">{p.title}</span>
            </Link>
          ))}
          <div className="my-2 border-t border-lp-ink/8" />
          <nav className="flex flex-col">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-lp-ink/80 hover:bg-lp-ink/6"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2 border-t border-lp-ink/8 pt-3">
            {isAuthed ? (
              <Link
                href="/accueil"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-pink text-sm font-semibold text-white"
              >
                Ouvrir l&apos;app
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-lp-ink/15 text-sm font-semibold text-lp-ink"
                >
                  Se connecter
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-pink text-sm font-semibold text-white"
                >
                  Commencer
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
