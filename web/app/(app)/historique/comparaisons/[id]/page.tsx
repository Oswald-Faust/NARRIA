"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { GitCompareArrows, Loader2, ArrowLeft } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComparisonReport, type ComparisonReportData } from "@/components/comparer/comparison-report";

const srjTone = (level: string) =>
  level === "Critique" ? "danger" : level === "Élevé" ? "pink" : level === "Modéré" ? "neutral" : "success";

export default function ComparisonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<ComparisonReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/compare/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Comparaison introuvable.");
        setResult(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GradientHeader
        title="Détail de la comparaison"
        subtitle="Rapport de similarité narrative complet entre les deux œuvres."
        icon={<GitCompareArrows className="h-6 w-6" />}
      />

      <Link href="/historique" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;historique
      </Link>

      {loading && (
        <Card className="flex items-center gap-2 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la comparaison…
        </Card>
      )}

      {error && <Card className="text-sm text-red-400">{error}</Card>}

      {result && (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{result.refWork.title} vs {result.candWork.title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone="purple">{result.detectedModality}</Badge>
              <Badge tone={srjTone(result.srjLevel)}>Risque {result.srjLevel}</Badge>
            </div>
          </div>
          <ComparisonReport data={result} />
        </Card>
      )}
    </div>
  );
}
