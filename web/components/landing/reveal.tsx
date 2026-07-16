"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RevealEffect = "up" | "left" | "right" | "zoom" | "blur" | "flip";

/**
 * Enveloppe de révélation au scroll : ajoute `.is-visible` quand l'élément
 * entre dans le viewport (une seule fois). Les animations elles-mêmes sont
 * pilotées en CSS (`.lp-reveal[data-effect]`, `.lp-bar`, `.lp-ring`…).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  effect = "up",
}: {
  children: ReactNode;
  className?: string;
  /** Décalage en secondes (var CSS --d). */
  delay?: number;
  /** Variante d'apparition (défaut : montée en fondu). */
  effect?: RevealEffect;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("lp-reveal", className)}
      data-effect={effect === "up" ? undefined : effect}
      style={delay ? ({ "--d": `${delay}s` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/** Titre découpé en mots qui apparaissent en cascade (au chargement). */
export function AnimatedWords({
  text,
  className,
  wordClassName,
  startDelay = 0,
  stagger = 0.09,
}: {
  text: string;
  className?: string;
  /** Classes posées sur chaque mot (utile pour un dégradé background-clip). */
  wordClassName?: string;
  startDelay?: number;
  stagger?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} aria-hidden>
          <span
            className={cn("lp-word", wordClassName)}
            style={{ "--d": `${startDelay + i * stagger}s` } as CSSProperties}
          >
            {word}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
