"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { GitCompareArrows, Loader2, FileText, ExternalLink, ScanText, CheckCircle2, TriangleAlert } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileDropzone, type FileDropzoneResult } from "@/components/analyse/file-dropzone";
import { ComparisonReport, type ComparisonReportData } from "@/components/comparer/comparison-report";
import { ColumnAnalysis, type ColumnAnalysisData } from "@/components/comparer/column-analysis";
import { ProgressBar } from "@/components/ui/progress-bar";
import { readNdjsonStream } from "@/lib/client/ndjson";
import type { NarrativeGraph } from "@/lib/engine";

interface Sample { id: string; title: string; author: string; text: string }
type CompareResult = ComparisonReportData;

/** Résultat du flux /api/compare/analyze : détail d'analyse + graphe brut réutilisable. */
type ColumnAnalyzeResult = ColumnAnalysisData & { graph: NarrativeGraph };

const srjTone = (level: string) =>
  level === "Critique" ? "danger" : level === "Élevé" ? "pink" : level === "Modéré" ? "neutral" : "success";

/**
 * Avertissement affiché pendant un traitement long. L'analyse et la comparaison
 * se déroulent dans un flux ouvert par la page : quitter l'onglet coupe la
 * requête et perd le travail en cours, sans que rien ne le signale autrement.
 */
function KeepOpenNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-yellow/40 bg-yellow/10 px-3 py-2 text-xs leading-5 text-foreground/80"
    >
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Garde-fou natif : tant qu'un traitement est en cours, le navigateur demande
 * confirmation avant une fermeture ou un rechargement. Complète l'avertissement
 * visuel, qui ne protège pas d'un réflexe de fermeture d'onglet.
 */
function useWarnBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Les navigateurs affichent leur propre message ; seule la prévention compte.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

/** État et logique d'une colonne (référence ou candidate) : saisie + analyse individuelle réutilisable. */
function useComparisonColumn(projectId: string | null) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setTextState] = useState("");
  const [graph, setGraph] = useState<NarrativeGraph | null>(null);
  const [analysis, setAnalysis] = useState<ColumnAnalysisData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Toute modification du texte périme le graphe déjà analysé : on force une ré-analyse
  // avant la comparaison pour ne jamais comparer un graphe obsolète.
  function setText(v: string) {
    setTextState(v);
    setGraph(null);
    setAnalysis(null);
  }

  function onExtracted(r: FileDropzoneResult) {
    setText(r.text);
    if (r.title.trim()) setTitle(r.title);
    if (r.author.trim()) setAuthor(r.author);
    setError(r.warnings.length > 0 ? r.warnings.join(" ") : null);
  }

  function applySample(s: Sample) {
    setText(s.text);
    setTitle(s.title);
    setAuthor(s.author);
    setError(null);
  }

  async function analyze() {
    if (text.trim().length < 200) {
      setError("Le texte doit contenir au moins 200 caractères.");
      return;
    }
    setError(null);
    setGraph(null);
    setAnalysis(null);
    setProgress(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/compare/analyze", {
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
        receivedOutcome = await readNdjsonStream<ColumnAnalyzeResult>(res, {
          onProgress: setProgress,
          onResult: (data) => {
            setGraph(data.graph);
            setAnalysis(data);
          },
          onError: (e) => setError(e),
        });
      } catch {
        setError("La connexion a été interrompue pendant l'analyse. Réessayez.");
        receivedOutcome = true;
      }
      if (!receivedOutcome) {
        setError(
          "L'analyse a été interrompue avant la fin, probablement parce que le texte est trop long. Réessayez avec un texte plus court, ou réessayez dans quelques instants.",
        );
      }
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  }

  function reset() {
    setText("");
    setTitle("");
    setAuthor("");
    setError(null);
    setProgress(null);
  }

  return {
    title, setTitle, author, setAuthor, text, setText,
    graph, analysis, analyzing, progress, error,
    analyze, applySample, onExtracted, reset,
  };
}

type ColumnState = ReturnType<typeof useComparisonColumn>;

function WorkColumn({
  label, accent, analyzeLabel, column, samples,
}: {
  label: string; accent: string; analyzeLabel: string;
  column: ColumnState; samples: Sample[];
}) {
  const analyzed = column.graph !== null;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
          <CardTitle>{label}</CardTitle>
        </div>
        {analyzed && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Analysé
          </span>
        )}
      </div>
      <div>
        <Label>Titre</Label>
        <Input value={column.title} onChange={(e) => column.setTitle(e.target.value)} placeholder="Titre de l'œuvre" />
      </div>
      <div>
        <Label>Auteur</Label>
        <Input value={column.author} onChange={(e) => column.setAuthor(e.target.value)} placeholder="Nom de l'auteur" />
      </div>
      <Textarea value={column.text} onChange={(e) => column.setText(e.target.value)} rows={9} placeholder="Collez le texte (200 caractères min.)…" />
      <FileDropzone onExtracted={column.onExtracted} />
      <div className="flex flex-wrap gap-1.5">
        {samples.map((s) => (
          <button
            key={s.id}
            onClick={() => column.applySample(s)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-foreground hover:border-soft-pink"
          >
            <FileText className="h-3 w-3" /> {s.title.split("(")[0].trim()}
          </button>
        ))}
      </div>

      <Button variant="secondary" onClick={column.analyze} disabled={column.analyzing} className="w-full justify-center">
        {column.analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
        {column.analyzing ? "Analyse…" : analyzed ? "Ré-analyser" : analyzeLabel}
      </Button>

      {column.analyzing && column.progress && (
        <div className="space-y-2">
          <ProgressBar percent={column.progress.percent} label={column.progress.message} />
          <KeepOpenNotice>
            Analyse en cours — gardez cet onglet ouvert : quitter la page l&apos;interromprait.
          </KeepOpenNotice>
        </div>
      )}
      {column.error && <p className="text-sm text-red-400">{column.error}</p>}

      {column.analysis && <ColumnAnalysis data={column.analysis} />}
    </Card>
  );
}

/**
 * Outil « Comparer deux textes », réutilisable dans la page autonome (/comparer)
 * et à l'intérieur d'un projet (/projets/[id]/comparer).
 */
export function ComparerTool({ projectId = null }: { projectId?: string | null }) {
  const ref = useComparisonColumn(projectId);
  const cand = useComparisonColumn(projectId);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/samples").then((r) => r.json()).then((d) => setSamples(d.samples ?? []));
  }, []);

  // Couvre les trois traitements interruptibles : les deux analyses de colonne
  // et la comparaison elle-même.
  useWarnBeforeUnload(loading || ref.analyzing || cand.analyzing);

  const bothAnalyzed = ref.graph !== null && cand.graph !== null;

  async function run() {
    if (!ref.graph || !cand.graph) return;
    setError(null);
    setResult(null);
    setProgress(null);
    setLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refGraph: ref.graph,
          candGraph: cand.graph,
          refTitle: ref.title,
          candTitle: cand.title,
          refAuthor: ref.author,
          candAuthor: cand.author,
          projectId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erreur lors de la comparaison.");
        return;
      }

      let receivedOutcome = false;
      try {
        receivedOutcome = await readNdjsonStream<CompareResult>(res, {
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
          "Le traitement a été interrompu avant la fin. Réessayez dans quelques instants.",
        );
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  function resetAll() {
    ref.reset();
    cand.reset();
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <WorkColumn label="Œuvre de référence" accent="bg-soft-purple" analyzeLabel="Analyser la référence" column={ref} samples={samples} />
        <WorkColumn label="Œuvre candidate" accent="bg-soft-pink" analyzeLabel="Analyser la candidate" column={cand} samples={samples} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!bothAnalyzed && (
        <p className="text-center text-sm text-muted">
          Analysez les deux œuvres pour activer la comparaison.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={resetAll}>
          Réinitialiser
        </Button>
        <Button variant="primary" onClick={run} disabled={loading || !bothAnalyzed}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
          {loading ? "Comparaison…" : "Lancer la comparaison"}
        </Button>
      </div>

      {loading && progress && (
        <div className="space-y-2">
          <ProgressBar percent={progress.percent} label={progress.message} />
          <KeepOpenNotice>
            Les deux œuvres sont en cours d&apos;analyse : l&apos;opération peut prendre plusieurs
            minutes. Gardez cet onglet ouvert jusqu&apos;au bout — si vous le fermez ou changez de
            page, la comparaison sera interrompue et devra être relancée.
          </KeepOpenNotice>
        </div>
      )}

      {result && (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Résultat de la comparaison</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone="purple">{result.detectedModality}</Badge>
              <Badge tone={srjTone(result.srjLevel)}>Risque {result.srjLevel}</Badge>
              {result.id && (
                <Link
                  href={`/historique/comparaisons/${result.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground hover:bg-surface-2"
                >
                  <ExternalLink className="h-3 w-3" /> Voir en page dédiée
                </Link>
              )}
            </div>
          </div>

          <ComparisonReport data={result} />
        </Card>
      )}
    </div>
  );
}
