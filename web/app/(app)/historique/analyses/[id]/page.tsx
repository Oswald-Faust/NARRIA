"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ScanText, ArrowLeft } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";
import { AnalysisReport, type AnalysisReportData } from "@/components/analyse/analysis-report";

type AnalyzeResult = AnalysisReportData & { nNodes: number; wordCount: number; functionSequence: string[] };

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analyze/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Analyse introuvable.");
        setResult(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GradientHeader
        title="Détail de l'analyse"
        subtitle="Rapport narratologique complet de cette œuvre."
        icon={<ScanText className="h-6 w-6" />}
      />

      <Link href="/historique" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;historique
      </Link>

      {loading && <LoadingBlock />}

      {error && <Card className="text-sm text-red-400">{error}</Card>}

      {result && (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Graphe narratif — {result.title}</CardTitle>
              <div className="flex gap-2">
                <Badge tone="purple">{result.nNodes} nœuds</Badge>
                <Badge tone="neutral">{result.wordCount} mots</Badge>
              </div>
            </div>
          </Card>
          <AnalysisReport data={result} />
        </>
      )}
    </div>
  );
}
