import { BookOpen, Download, Sparkles } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActantialDiagram } from "@/components/analyse/actantial-diagram";
import type { MainActants } from "@/lib/reports/actantial-geometry";

export interface AnalysisReportNode {
  nodeId: string;
  functionCode: string | null;
  functionName: string | null;
  functionFamily: string | null;
  actants: string[];
  modalities: { vouloir: number; devoir: number; pouvoir: number; savoir: number };
  tension: number;
  phase: string | null;
  textExcerpt: string;
}

export interface AnalysisReportData {
  id?: string;
  title: string;
  author: string;
  mode: string;
  summary?: string;
  genre?: string;
  tradition?: string;
  mainActants?: { v1: MainActants; v2: MainActants };
  thematicKeywords?: string[];
  nodes: AnalysisReportNode[];
  costUsd?: number;
  tokensTotal?: number;
}

const ACTANT_ROWS: { key: keyof MainActants; label: string }[] = [
  { key: "protagoniste", label: "Sujet (protagoniste)" },
  { key: "objet", label: "Objet de la quête" },
  { key: "destinateur", label: "Destinateur" },
  { key: "destinataire", label: "Destinataire" },
  { key: "adjuvant", label: "Adjuvant" },
  { key: "opposant", label: "Opposant" },
];

export function AnalysisReport({ data }: { data: AnalysisReportData }) {
  const actantsV1 = data.mainActants?.v1;

  return (
    <div className="space-y-6">
      {(data.summary || data.genre || actantsV1) && (
        <Card className="space-y-4 border-l-4 border-l-soft-pink">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-soft-pink" /> Synthèse de l&apos;analyse
          </CardTitle>
          {data.summary && <p className="text-sm text-foreground">{data.summary}</p>}
          <div className="flex flex-wrap gap-4 text-sm">
            {data.genre && (
              <p>
                <span className="font-semibold text-foreground">Genre : </span>
                <span className="text-muted">{data.genre}</span>
              </p>
            )}
            {data.tradition && (
              <p>
                <span className="font-semibold text-foreground">Filiation narrative du texte : </span>
                <span className="text-muted">{data.tradition}</span>
              </p>
            )}
          </div>
          {data.thematicKeywords && data.thematicKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.thematicKeywords.map((kw) => (
                <Badge key={kw} tone="pink">{kw}</Badge>
              ))}
            </div>
          )}

          {actantsV1 && (
            <div className="space-y-4 pt-2">
              <h3 className="font-heading text-sm font-bold text-soft-purple">Schéma actantiel identifié</h3>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {ACTANT_ROWS.map((row) => (
                      <tr key={row.key} className="border-b border-border last:border-0">
                        <td className="w-1/3 bg-surface-2 px-3 py-2 font-semibold text-foreground">{row.label}</td>
                        <td className="px-3 py-2 text-muted">{actantsV1[row.key]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ActantialDiagram actants={actantsV1} />
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-soft-purple" /> Graphe narratif ({data.nodes.length} nœuds)
        </CardTitle>
        <div className="space-y-3">
          {data.nodes.map((n) => (
            <div key={n.nodeId} className="space-y-2 rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-sm font-bold text-soft-purple">{n.nodeId}</span>
                {n.functionCode && <Badge tone={n.functionCode.startsWith("FN") ? "yellow" : "pink"}>{n.functionCode}</Badge>}
                <span className="text-sm text-foreground">{n.functionName}</span>
                {n.functionFamily && <span className="text-xs text-muted">· {n.functionFamily}</span>}
                {n.phase && <Badge tone="neutral">{n.phase}</Badge>}
              </div>
              {n.actants.length > 0 && (
                <p className="text-xs text-muted">Actants : {n.actants.join(", ")}</p>
              )}
              <p className="text-xs text-muted">
                Modalités : vouloir={n.modalities.vouloir.toFixed(2)} · devoir={n.modalities.devoir.toFixed(2)} ·
                pouvoir={n.modalities.pouvoir.toFixed(2)} · savoir={n.modalities.savoir.toFixed(2)}
              </p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-gradient-to-r from-soft-purple to-pink" style={{ width: `${n.tension * 100}%` }} />
                </div>
                <span className="text-xs text-muted">tension {n.tension.toFixed(2)}</span>
              </div>
              {n.textExcerpt && (
                <blockquote className="border-l-2 border-soft-pink/50 pl-3 text-sm italic text-muted">
                  « {n.textExcerpt} »
                </blockquote>
              )}
            </div>
          ))}
        </div>
      </Card>

      {data.mode === "llm" && data.costUsd != null && (
        <p className="text-right text-xs italic text-muted">
          Analyse via Claude — coût : {data.costUsd.toFixed(4)} USD · {(data.tokensTotal ?? 0).toLocaleString("fr-FR")} tokens
        </p>
      )}

      {data.id && (
        <div className="flex flex-wrap justify-end gap-2">
          {(["pdf", "html", "md", "json"] as const).map((fmt) => (
            <a
              key={fmt}
              href={`/api/analyze/${data.id}/export?format=${fmt}`}
              download
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm text-foreground hover:bg-surface-2"
            >
              <Download className="h-4 w-4" /> {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
