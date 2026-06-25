"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Fn { code: string; name: string; description: string; african?: boolean }
interface Family { id: string; name: string; functions: Fn[] }
interface RepData { total: number; families: number; african: number; repertoire: { families: Family[] } }

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card className="text-center">
      <p className="font-heading text-3xl font-bold text-gradient-narria">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </Card>
  );
}

export default function RepertoirePage() {
  const [data, setData] = useState<RepData | null>(null);
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    fetch("/api/repertoire").then((r) => r.json()).then(setData);
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.repertoire.families
      .filter((f) => active === "all" || f.id === active)
      .flatMap((f) => f.functions.map((fn) => ({ ...fn, familyName: f.name })));
  }, [data, active]);

  if (!data) return <p className="text-muted">Chargement du répertoire…</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title="Répertoire des fonctions narratives"
        subtitle="Les fonctions cardinales identifiées par NARR'IA, organisées en familles — dont un apport propre aux traditions africaines."
        icon={<BookMarked className="h-6 w-6" />}
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat value={data.total} label="Fonctions" />
        <Stat value={data.families} label="Familles" />
        <Stat value={data.african} label="Fonctions africaines" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActive("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${active === "all" ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-foreground"}`}
        >
          Toutes
        </button>
        {data.repertoire.families.map((f) => (
          <button
            key={f.id}
            onClick={() => setActive(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${active === f.id ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            {f.id}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Nom</th>
              <th className="px-5 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((fn) => (
              <tr key={fn.code} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                <td className="px-5 py-3">
                  <Badge tone={fn.african ? "yellow" : "purple"}>{fn.code}</Badge>
                </td>
                <td className="px-5 py-3 font-semibold text-foreground">{fn.name}</td>
                <td className="px-5 py-3 text-muted">{fn.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
