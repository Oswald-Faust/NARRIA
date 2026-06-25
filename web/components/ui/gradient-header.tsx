import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bandeau de section en dégradé violet — repris des écrans
 * Analyser / Comparer / Répertoire de la maquette.
 */
export function GradientHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-gradient-narria flex items-center justify-between gap-4 rounded-[var(--radius-card)] px-7 py-6 text-white",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-wide">{title}</h2>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-white/80">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}
