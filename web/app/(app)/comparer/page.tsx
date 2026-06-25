"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, Loader2, FileText, TriangleAlert } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Sample { id: string; title: string; author: string; text: string }
interface CompareResult {
  sns: number; ss: number; st: number; srj: number; srjLevel: string;
  sIso: number; sGed: number; sFunc: number; sAct: number; sTens: number;
  detectedModality: string; verdict: string; warnings: string[];
}

const srjTone = (level: string) =>
  level === "Critique" ? "danger" : level === "Élevé" ? "pink" : level === "Modéré" ? "yellow" : "success";

function WorkColumn({
  label, title, setTitle, text, setText, samples, accent,
}: {
  label: string; title: string; setTitle: (v: string) => void;
  text: string; setText: (v: string) => void; samples: Sample[]; accent: string;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <CardTitle>{label}</CardTitle>
      </div>
      <div>
        <Label>Titre</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'œuvre" />
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder="Collez le texte (200 caractères min.)…" />
      <div className="flex flex-wrap gap-1.5">
        {samples.map((s) => (
          <button
            key={s.id}
            onClick={() => { setText(s.text); setTitle(s.title); }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-foreground hover:border-soft-pink"
          >
            <FileText className="h-3 w-3" /> {s.title.split("(")[0].trim()}
          </button>
        ))}
      </div>
    </Card>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 text-center">
      <p className="font-heading text-2xl font-bold text-foreground">{value.toFixed(2)}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

export default function ComparerPage() {
  const [refTitle, setRefTitle] = useState("");
  const [candTitle, setCandTitle] = useState("");
  const [refText, setRefText] = useState("");
  const [candText, setCandText] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  useEffect(() => {
    fetch("/api/samples").then((r) => r.json()).then((d) => setSamples(d.samples ?? []));
  }, []);

  async function run() {
    setError(null); setResult(null); setLoading(true);
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refText, candText, refTitle, candTitle }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Erreur lors de la comparaison.");
    setResult(data);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GradientHeader
        title="Comparer deux textes"
        subtitle="Confrontez une œuvre de référence à une œuvre candidate et obtenez les scores SNS, SS, ST et SRJ."
        icon={<GitCompareArrows className="h-6 w-6" />}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <WorkColumn label="Œuvre de référence" title={refTitle} setTitle={setRefTitle} text={refText} setText={setRefText} samples={samples} accent="bg-soft-purple" />
        <WorkColumn label="Œuvre candidate" title={candTitle} setTitle={setCandTitle} text={candText} setText={setCandText} samples={samples} accent="bg-soft-pink" />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => { setRefText(""); setCandText(""); setRefTitle(""); setCandTitle(""); setResult(null); }}>
          Réinitialiser
        </Button>
        <Button variant="primary" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
          {loading ? "Comparaison…" : "Lancer la comparaison"}
        </Button>
      </div>

      {result && (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Résultat de la comparaison</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone="purple">{result.detectedModality}</Badge>
              <Badge tone={srjTone(result.srjLevel)}>Risque {result.srjLevel}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreTile label="SNS" value={result.sns} />
            <ScoreTile label="Spécificité" value={result.ss} />
            <ScoreTile label="Transformation" value={result.st} />
            <ScoreTile label="Risque (SRJ)" value={result.srj} />
          </div>

          <div>
            <Label>Composantes du SNS</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <ScoreTile label="Isomorphisme" value={result.sIso} />
              <ScoreTile label="GED" value={result.sGed} />
              <ScoreTile label="Fonctions" value={result.sFunc} />
              <ScoreTile label="Actants" value={result.sAct} />
              <ScoreTile label="Tension" value={result.sTens} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="mb-1 font-heading text-sm font-bold">Verdict interprétatif</p>
            <p className="text-sm text-foreground/90">{result.verdict}</p>
          </div>

          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-yellow/30 bg-yellow/10 px-4 py-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow" />
              <p className="text-xs text-foreground/90">{w}</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
