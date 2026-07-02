"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, Loader2, FileText } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileDropzone, type FileDropzoneResult } from "@/components/analyse/file-dropzone";
import { ComparisonReport, type ComparisonReportData } from "@/components/comparer/comparison-report";

interface Sample { id: string; title: string; author: string; text: string }
type CompareResult = ComparisonReportData;

const srjTone = (level: string) =>
  level === "Critique" ? "danger" : level === "Élevé" ? "pink" : level === "Modéré" ? "neutral" : "success";

function WorkColumn({
  label, title, setTitle, text, setText, samples, accent, onExtracted,
}: {
  label: string; title: string; setTitle: (v: string) => void;
  text: string; setText: (v: string) => void; samples: Sample[]; accent: string;
  onExtracted: (r: FileDropzoneResult) => void;
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
      <FileDropzone onExtracted={onExtracted} />
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

  function handleRefExtracted(r: FileDropzoneResult) {
    setRefText(r.text);
    if (r.title.trim()) setRefTitle(r.title);
    setError(r.warnings.length > 0 ? r.warnings.join(" ") : null);
  }

  function handleCandExtracted(r: FileDropzoneResult) {
    setCandText(r.text);
    if (r.title.trim()) setCandTitle(r.title);
    setError(r.warnings.length > 0 ? r.warnings.join(" ") : null);
  }

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
        <WorkColumn label="Œuvre de référence" title={refTitle} setTitle={setRefTitle} text={refText} setText={setRefText} samples={samples} accent="bg-soft-purple" onExtracted={handleRefExtracted} />
        <WorkColumn label="Œuvre candidate" title={candTitle} setTitle={setCandTitle} text={candText} setText={setCandText} samples={samples} accent="bg-soft-pink" onExtracted={handleCandExtracted} />
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

          <ComparisonReport data={result} />
        </Card>
      )}
    </div>
  );
}
