import * as React from "react";
import { cn } from "@/lib/utils";
import { koba } from "@/lib/fonts";

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
        "bg-gradient-narria flex flex-col gap-4 rounded-[var(--radius-card)] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:h-12 sm:w-12">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className={cn(koba.className, "text-2xl font-semibold tracking-wide sm:text-3xl")}>{title}</h2>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-white/80">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
