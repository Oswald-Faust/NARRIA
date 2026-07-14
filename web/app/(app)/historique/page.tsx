"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, ExternalLink } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";

interface AnalysisItem { id: string; title: string; author: string; mode: string; nNodes: number; createdAt: string }
interface ComparisonItem { id: string; refTitle: string; candTitle: string; sns: number; srjLevel: string; modality: string; createdAt: string }

const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const srjTone = (l: string) => (l === "Critique" ? "danger" : l === "Élevé" ? "pink" : l === "Modéré" ? "yellow" : "success");

export default function HistoriquePage() {
  const [tab, setTab] = useState<"analyses" | "comparaisons">("analyses");
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => { setAnalyses(d.analyses ?? []); setComparisons(d.comparisons ?? []); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title="Historique"
        subtitle="Consultez vos analyses et comparaisons passées."
        icon={<History className="h-6 w-6" />}
      />

      <div className="flex gap-2">
        {(["analyses", "comparaisons"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <LoadingBlock />
        ) : tab === "analyses" ? (
          analyses.length === 0 ? (
            <p className="p-6 text-muted">Aucune analyse pour le moment.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Titre</th><th className="px-5 py-3">Auteur</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Nœuds</th><th className="px-5 py-3"></th></tr>
              </thead>
              <tbody>
                {analyses.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3 text-muted">{fmt(a.createdAt)}</td>
                    <td className="px-5 py-3 font-semibold text-foreground">{a.title}</td>
                    <td className="px-5 py-3 text-muted">{a.author}</td>
                    <td className="px-5 py-3"><Badge tone="neutral">{a.mode}</Badge></td>
                    <td className="px-5 py-3 text-muted">{a.nNodes}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/historique/analyses/${a.id}`} className="inline-flex items-center gap-1 text-xs text-soft-pink hover:underline">
                        <ExternalLink className="h-3 w-3" /> Consulter
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : comparisons.length === 0 ? (
          <p className="p-6 text-muted">Aucune comparaison pour le moment.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Référence</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">SNS</th><th className="px-5 py-3">Risque</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                  <td className="px-5 py-3 text-muted">{fmt(c.createdAt)}</td>
                  <td className="px-5 py-3 font-semibold text-foreground">{c.refTitle}</td>
                  <td className="px-5 py-3 text-foreground">{c.candTitle}</td>
                  <td className="px-5 py-3"><Badge tone="pink">{c.sns?.toFixed(2)}</Badge></td>
                  <td className="px-5 py-3"><Badge tone={srjTone(c.srjLevel)}>{c.srjLevel}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/historique/comparaisons/${c.id}`} className="inline-flex items-center gap-1 text-xs text-soft-pink hover:underline">
                      <ExternalLink className="h-3 w-3" /> Consulter
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
