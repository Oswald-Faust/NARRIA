import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Comparison } from "@/lib/db/models/comparison";
import { analyzeLLM, compare, LlmExtractionError } from "@/lib/engine";
import type { NarrativeGraph } from "@/lib/engine";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";
import { createNotification } from "@/lib/notifications";
import { recordUsage } from "@/lib/usage";
import { describeExtractionProgress } from "@/lib/progress-messages";
import { resolveProjectLaunchContext } from "@/lib/projects/permissions";
import { buildWork } from "@/lib/reports/comparison-work";

export const runtime = "nodejs";
// Cf. /api/analyze : un texte long peut prendre plus de temps qu'anticipé pour un seul
// appel LLM, même si les deux œuvres sont analysées en parallèle (Promise.all).
export const maxDuration = 300;

/** Valide (a minima) un graphe fourni par le client après analyse individuelle d'une colonne. */
function asNarrativeGraph(value: unknown): NarrativeGraph | null {
  if (!value || typeof value !== "object") return null;
  const g = value as Partial<NarrativeGraph>;
  if (typeof g.graphId !== "string") return null;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;
  if (!g.metadata || typeof g.metadata !== "object") return null;
  return g as NarrativeGraph;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Clé ANTHROPIC_API_KEY manquante côté serveur." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const refText: string = body?.refText ?? "";
  const candText: string = body?.candText ?? "";
  const refTitle: string = body?.refTitle || "Œuvre de référence";
  const candTitle: string = body?.candTitle || "Œuvre candidate";
  const refAuthor: string = body?.refAuthor || "Auteur inconnu";
  const candAuthor: string = body?.candAuthor || "Auteur inconnu";
  const refSourceFile = body?.refSourceFile ?? null;
  const candSourceFile = body?.candSourceFile ?? null;
  void refSourceFile;
  void candSourceFile;

  // Réutilisation des graphes déjà produits par « Analyser la référence / candidate »
  // (via /api/compare/analyze) : on saute l'appel LLM et on compare directement.
  const preRefGraph = asNarrativeGraph(body?.refGraph);
  const preCandGraph = asNarrativeGraph(body?.candGraph);
  const reuseGraphs = Boolean(preRefGraph && preCandGraph);

  const { projectId, error: projectError } = await resolveProjectLaunchContext(body?.projectId, session.user.id);
  if (projectError) {
    return NextResponse.json({ error: projectError }, { status: 403 });
  }

  if (!reuseGraphs && (refText.trim().length < 200 || candText.trim().length < 200)) {
    return NextResponse.json(
      { error: "Chaque texte doit contenir au moins 200 caractères." },
      { status: 400 },
    );
  }

  const ownerId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        let refFraction = 0;
        let candFraction = 0;
        function sendCombinedProgress() {
          const fraction = (refFraction + candFraction) / 2;
          const percent = Math.round(fraction * 100);
          const bothDone = refFraction >= 1 && candFraction >= 1;
          const message = bothDone
            ? "Finalisation de la comparaison…"
            : describeExtractionProgress(percent);
          send({ type: "progress", percent, message });
        }

        let gRef: NarrativeGraph;
        let gCand: NarrativeGraph;
        let refCostUsd: number;
        let candCostUsd: number;

        if (reuseGraphs) {
          // Graphes déjà analysés côté colonnes : l'usage/coût LLM a été enregistré à l'étape
          // « Analyser » (/api/compare/analyze). On ne re-facture rien ici.
          gRef = preRefGraph!;
          gCand = preCandGraph!;
          refCostUsd = 0;
          candCostUsd = 0;
          send({ type: "progress", percent: 50, message: "Comparaison des graphes narratifs…" });
        } else {
          let refOutcome;
          let candOutcome;
          try {
            // Parallélise les deux analyses indépendantes (~/2 de latence, marge face à maxDuration).
            // Compromis : si un seul appel échoue, Promise.all rejette et le coût de l'appel *réussi*
            // n'est pas récupérable ici — même trou qu'en séquentiel, sans régression de traçage.
            [refOutcome, candOutcome] = await Promise.all([
              analyzeLLM(refText, { title: refTitle, author: refAuthor }, (event) => {
                refFraction = event.fraction;
                sendCombinedProgress();
              }),
              analyzeLLM(candText, { title: candTitle, author: candAuthor }, (event) => {
                candFraction = event.fraction;
                sendCombinedProgress();
              }),
            ]);
          } catch (e) {
            let partial: { inputTokens?: number; outputTokens?: number; costUsd?: number } | undefined;
            if (e instanceof LlmExtractionError) {
              partial = e.partialUsage;
              console.error(
                `Comparaison LLM échouée après un coût partiel de ${partial?.costUsd ?? 0} USD (${(partial?.inputTokens ?? 0) + (partial?.outputTokens ?? 0)} tokens).`,
              );
            }
            const message = e instanceof Error ? e.message : "Erreur lors de l'analyse LLM.";
            void recordUsage({
              ownerId,
              route: "compare",
              model: EXTRACTION_MODEL_ID,
              inputTokens: partial?.inputTokens ?? 0,
              outputTokens: partial?.outputTokens ?? 0,
              success: false,
              error: message,
            });
            send({ type: "error", error: message, status: 502 });
            return;
          }

          gRef = refOutcome.graph;
          gCand = candOutcome.graph;
          refCostUsd = refOutcome.usage.costUsd;
          candCostUsd = candOutcome.usage.costUsd;

          void recordUsage({
            ownerId,
            route: "compare",
            model: EXTRACTION_MODEL_ID,
            inputTokens: refOutcome.usage.inputTokens + candOutcome.usage.inputTokens,
            outputTokens: refOutcome.usage.outputTokens + candOutcome.usage.outputTokens,
          });
        }

        const totalCost = refCostUsd + candCostUsd;

        const result = compare(gRef, gCand);

        send({ type: "progress", percent: 99, message: "Enregistrement de la comparaison…" });

        await connectDB();
        const doc = await Comparison.create({
          ownerId,
          refTitle,
          candTitle,
          mode: "llm",
          scores: {
            sns: result.sns, snsNormalized: result.snsNormalized, ss: result.ss, st: result.st, srj: result.srj,
            sIso: result.sIso, sGed: result.sGed, sFunc: result.sFunc,
            sAct: result.sAct, sTens: result.sTens,
          },
          snsNormalized: result.snsNormalized,
          srjLevel: result.srjLevel,
          modality: result.detectedModality,
          verdict: result.verdict,
          correspondences: result.correspondences,
          warnings: result.warnings,
          coverage: result.coverage,
          genre: result.genre,
          normalizationApplied: result.normalizationApplied,
          baseline: result.baseline,
          alert: result.alert,
          costUsd: totalCost,
          refGraph: gRef,
          candGraph: gCand,
          projectId,
        });

        const pct = Math.round((result.sns ?? 0) * 100);
        // §5 de la note interne du 27/07/2026 : l'alerte ne découle plus mécaniquement
        // du niveau SRJ (lui-même dérivé d'un SNS non discriminant) mais de la décision
        // explicite du moteur — couverture, genres et baseline compris.
        const high = result.alert.triggered;
        await createNotification({
          ownerId,
          type: high ? "ip" : "comparison",
          title: high
            ? `Similarité élevée détectée — ${refTitle} / ${candTitle}`
            : `Comparaison terminée — ${refTitle} / ${candTitle}`,
          body: `Indice de similarité narrative : ${pct} %. Niveau de risque : ${result.srjLevel}.`,
          href: "/historique",
        });

        send({
          type: "result",
          data: {
            id: String(doc._id),
            refTitle,
            candTitle,
            mode: "llm",
            costUsd: totalCost,
            refWork: buildWork(gRef, refCostUsd),
            candWork: buildWork(gCand, candCostUsd),
            ...result,
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
