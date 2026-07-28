"use client";

import { Sparkles, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnalysisReportNode } from "@/components/analyse/analysis-report";
import type { MainActants } from "@/lib/reports/actantial-geometry";

/** Détail d'analyse d'une seule œuvre, affiché sous sa colonne dans /comparer. */
export interface ColumnAnalysisData {
  nNodes: number;
  wordCount: number;
  functionSequence: string[];
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
  { key: "protagoniste", label: "Sujet" },
  { key: "objet", label: "Objet" },
  { key: "destinateur", label: "Destinateur" },
  { key: "destinataire", label: "Destinataire" },
  { key: "adjuvant", label: "Adjuvant" },
  { key: "opposant", label: "Opposant" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-soft-purple">{title}</h4>
      {children}
    </div>
  );
}

export function ColumnAnalysis({ data }: { data: ColumnAnalysisData }) {
  const actants = data.mainActants?.v1;
  const hasActants = actants && ACTANT_ROWS.some((r) => actants[r.key]?.trim());

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-soft-pink">
          <Sparkles className="h-3.5 w-3.5" /> Synthèse
        </span>
        <Badge tone="purple">{data.nNodes} nœuds</Badge>
        <Badge tone="neutral">{data.wordCount} mots</Badge>
      </div>

      {data.summary && <p className="text-sm leading-relaxed text-foreground">{data.summary}</p>}

      {(data.genre || data.tradition) && (
        <div className="flex flex-col gap-1 text-xs">
          {data.genre && (
            <p><span className="font-semibold text-foreground">Genre : </span><span className="text-muted">{data.genre}</span></p>
          )}
          {data.tradition && (
            <p><span className="font-semibold text-foreground">Filiation narrative du texte : </span><span className="text-muted">{data.tradition}</span></p>
          )}
        </div>
      )}

      {data.thematicKeywords && data.thematicKeywords.length > 0 && (
        <Section title="Mots-clés thématiques">
          <div className="flex flex-wrap gap-1.5">
            {data.thematicKeywords.map((kw) => (
              <Badge key={kw} tone="pink">{kw}</Badge>
            ))}
          </div>
        </Section>
      )}

      {hasActants && (
        <Section title="Schéma actantiel">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <tbody>
                {ACTANT_ROWS.filter((r) => actants![r.key]?.trim()).map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="w-2/5 bg-surface px-2.5 py-1.5 font-semibold text-foreground">{row.label}</td>
                    <td className="px-2.5 py-1.5 text-muted">{actants![row.key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Séquence de fonctions">
        <div className="flex flex-wrap gap-1.5">
          {data.functionSequence.length ? (
            data.functionSequence.map((c, i) => (
              <Badge key={i} tone={c.startsWith("FN") ? "yellow" : "pink"}>{c}</Badge>
            ))
          ) : (
            <span className="text-xs text-muted">Aucune fonction identifiée.</span>
          )}
        </div>
      </Section>

      {data.nodes.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft-purple hover:text-soft-pink">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Graphe narratif détaillé ({data.nodes.length} nœuds)
          </summary>
          <div className="mt-2 space-y-2">
            {data.nodes.map((n) => (
              <div key={n.nodeId} className="space-y-1.5 rounded-lg border border-border bg-surface p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-heading text-xs font-bold text-soft-purple">{n.nodeId}</span>
                  {n.functionCode && <Badge tone={n.functionCode.startsWith("FN") ? "yellow" : "pink"}>{n.functionCode}</Badge>}
                  {n.functionName && <span className="text-xs text-foreground">{n.functionName}</span>}
                  {n.phase && <Badge tone="neutral">{n.phase}</Badge>}
                </div>
                {n.functionFamily && <p className="text-[11px] text-muted">{n.functionFamily}</p>}
                {n.actants.length > 0 && (
                  <p className="text-[11px] text-muted">Actants : {n.actants.join(", ")}</p>
                )}
                <p className="text-[11px] text-muted">
                  V={n.modalities.vouloir.toFixed(2)} · D={n.modalities.devoir.toFixed(2)} ·
                  P={n.modalities.pouvoir.toFixed(2)} · S={n.modalities.savoir.toFixed(2)}
                </p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full bg-gradient-to-r from-soft-purple to-pink" style={{ width: `${n.tension * 100}%` }} />
                  </div>
                  <span className="text-[11px] text-muted">tension {n.tension.toFixed(2)}</span>
                </div>
                {n.textExcerpt && (
                  <blockquote className="border-l-2 border-soft-pink/50 pl-2 text-[11px] italic text-muted">
                    « {n.textExcerpt} »
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {data.costUsd != null && (
        <p className="text-right text-[11px] italic text-muted">
          {data.costUsd.toFixed(4)} USD · {(data.tokensTotal ?? 0).toLocaleString("fr-FR")} tokens
        </p>
      )}
    </div>
  );
}
