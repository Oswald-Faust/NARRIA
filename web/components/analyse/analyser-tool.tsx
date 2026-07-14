"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScanText, Loader2, FileText, ExternalLink } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileDropzone, type FileDropzoneResult } from "@/components/analyse/file-dropzone";
import { AnalysisReport, type AnalysisReportData } from "@/components/analyse/analysis-report";
import { ProgressBar } from "@/components/ui/progress-bar";
import { readNdjsonStream } from "@/lib/client/ndjson";

type AnalyzeResult = AnalysisReportData & {
  nNodes: number;
  wordCount: number;
  functionSequence: string[];
};
interface Sample {
  id: string;
  title: string;
  author: string;
  text: string;
}

/**
 * Outil « Analyser un texte », réutilisable tel quel dans la page autonome (/analyser)
 * et à l'intérieur d'un projet (/projets/[id]/analyser) — le `projectId` rattache
 * l'analyse produite au projet courant.
 */
export function AnalyserTool({ projectId }: { projectId?: string | null }) {
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);

  function handleExtracted(r: FileDropzoneResult) {
    setText(r.text);
    if (r.title.trim()) setTitle(r.title);
    if (r.author.trim()) setAuthor(r.author);
    setError(r.warnings.length > 0 ? r.warnings.join(" ") : null);
  }

  useEffect(() => {
    fetch("/api/samples").then((r) => r.json()).then((d) => setSamples(d.samples ?? []));
  }, []);

  async function run() {
    setError(null);
    setResult(null);
    setProgress(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title, author, projectId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erreur lors de l'analyse.");
        return;
      }

      let receivedOutcome = false;
      try {
        receivedOutcome = await readNdjsonStream<AnalyzeResult>(res, {
          onProgress: setProgress,
          onResult: (data) => setResult(data),
          onError: (e) => setError(e),
        });
      } catch {
        setError("La connexion a été interrompue pendant le traitement. Réessayez.");
        receivedOutcome = true;
      }
      if (!receivedOutcome) {
        setError(
          "Le traitement a été interrompu avant la fin, probablement parce que le texte est trop long. Réessayez avec un texte plus court, ou réessayez dans quelques instants.",
        );
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <CardTitle>Informations sur l&apos;œuvre</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nom de l&apos;auteur</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ex. William Shakespeare" />
          </div>
          <div>
            <Label>Titre de l&apos;œuvre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Roméo et Juliette" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Texte de l&apos;œuvre</Label>
            <span className="text-xs text-muted">{text.trim() ? text.trim().split(/\s+/).length : 0} mots</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Collez ici le texte à analyser (200 caractères minimum)…"
          />
        </div>

        <FileDropzone onExtracted={handleExtracted} />

        {samples.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Échantillons :</span>
            {samples.map((s) => (
              <button
                key={s.id}
                onClick={() => { setText(s.text); setTitle(s.title); setAuthor(s.author); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-foreground hover:border-soft-pink"
              >
                <FileText className="h-3 w-3" /> {s.title.split("(")[0].trim()}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => { setText(""); setTitle(""); setAuthor(""); setResult(null); }}>
            Réinitialiser
          </Button>
          <Button variant="primary" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
            {loading ? "Analyse…" : "Lancer l'analyse narrative"}
          </Button>
        </div>

        {loading && progress && <ProgressBar percent={progress.percent} label={progress.message} />}
      </Card>

      {result && (
        <>
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Graphe narratif — {result.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone="purple">{result.nNodes} nœuds</Badge>
                <Badge tone="neutral">{result.wordCount} mots</Badge>
                {result.id && (
                  <Link
                    href={`/historique/analyses/${result.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground hover:bg-surface-2"
                  >
                    <ExternalLink className="h-3 w-3" /> Voir en page dédiée
                  </Link>
                )}
              </div>
            </div>

            <div>
              <Label>Séquence de fonctions</Label>
              <div className="flex flex-wrap gap-2">
                {result.functionSequence.length ? (
                  result.functionSequence.map((c, i) => (
                    <Badge key={i} tone={c.startsWith("FN") ? "yellow" : "pink"}>{c}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted">Aucune fonction identifiée.</span>
                )}
              </div>
            </div>
          </Card>

          <AnalysisReport data={result} />
        </>
      )}
    </div>
  );
}
