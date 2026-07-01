import * as React from "react";
import { cn } from "@/lib/utils";

/** Carte KPI du dashboard admin : icône, valeur, libellé, indice secondaire. */
export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "purple",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "purple" | "pink" | "emerald" | "amber" | "sky";
}) {
  const tones: Record<string, string> = {
    purple: "bg-soft-purple/15 text-soft-purple",
    pink: "bg-soft-pink/15 text-soft-pink",
    emerald: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-500",
    sky: "bg-sky-500/15 text-sky-400",
  };
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-3 font-heading text-2xl font-bold text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
