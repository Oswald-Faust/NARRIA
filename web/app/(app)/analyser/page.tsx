"use client";

import { useEffect, useState } from "react";
import { ScanText, Loader2, FileText } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileDropzone, type FileDropzoneResult } from "@/components/analyse/file-dropzone";

interface NodeOut {
  nodeId: string;
  functionCode: string | null;
  functionName: string | null;
  functionFamily: string | null;
  phase: string | null;
  tension: number;
  actants: string[];
}
interface AnalyzeResult {
  title: string;
  nNodes: number;
  wordCount: number;
  functionSequence: string[];
  nodes: NodeOut[];
}
interface Sample {
  id: string;
  title: string;
  author: string;
  text: string;
}

export default function AnalyserPage() {
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

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
    setLoading(true);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title, author }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Erreur lors de l'analyse.");
    setResult(data);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GradientHeader
        title="Analyser un texte"
        subtitle="Soumettez une œuvre : NARR'IA en extrait la structure narrative profonde et le graphe de fonctions."
        icon={<ScanText className="h-6 w-6" />}
      />

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
      </Card>

      {result && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Graphe narratif — {result.title}</CardTitle>
            <div className="flex gap-2">
              <Badge tone="purple">{result.nNodes} nœuds</Badge>
              <Badge tone="neutral">{result.wordCount} mots</Badge>
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

          <div className="space-y-2">
            {result.nodes.map((n) => (
              <div key={n.nodeId} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                <span className="font-heading text-sm font-bold text-soft-purple">{n.nodeId}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {n.functionCode ? (
                      <>
                        <span className="font-semibold">{n.functionCode}</span> — {n.functionName}
                        <span className="text-muted"> · {n.functionFamily}</span>
                      </>
                    ) : (
                      <span className="text-muted">Fonction non identifiée</span>
                    )}
                  </p>
                  {n.actants.length > 0 && (
                    <p className="truncate text-xs text-muted">Actants : {n.actants.join(", ")}</p>
                  )}
                </div>
                <Badge tone="neutral">{n.phase}</Badge>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                    <div className="h-full bg-gradient-to-r from-soft-purple to-pink" style={{ width: `${n.tension * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs text-muted">{n.tension.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
