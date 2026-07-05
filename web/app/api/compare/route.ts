import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Comparison } from "@/lib/db/models/comparison";
import { analyzeLLM, compare, LlmExtractionError, tensionProfile } from "@/lib/engine";
import type { NarrativeGraph } from "@/lib/engine";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";
import { createNotification } from "@/lib/notifications";
import { recordUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 180;

/** Extrait les infos par-œuvre nécessaires au rapport de comparaison (sections « Œuvres comparées » et « Analyse LLM »). */
function buildWork(g: NarrativeGraph, costUsd: number) {
  const meta = g.metadata as Record<string, unknown>;
  const actants = meta.main_actants_v1 as
    | { protagoniste?: string; objet?: string; destinateur?: string; destinataire?: string; adjuvant?: string; opposant?: string }
    | undefined;
  return {
    title: String(meta.title ?? "Œuvre"),
    author: String(meta.author ?? "Auteur inconnu"),
    graphId: g.graphId,
    nNodes: g.nodes.length,
    nEdges: g.edges.length,
    tensionProfile: tensionProfile(g),
    summary: typeof meta.summary === "string" ? meta.summary : "",
    genre: typeof meta.genre === "string" ? meta.genre : "",
    tradition: typeof meta.tradition === "string" ? meta.tradition : "",
    thematicKeywords: Array.isArray(meta.thematicKeywords) ? (meta.thematicKeywords as string[]) : [],
    mainActants: actants
      ? {
          protagoniste: actants.protagoniste ?? "",
          objet: actants.objet ?? "",
          destinateur: actants.destinateur ?? "",
          destinataire: actants.destinataire ?? "",
          adjuvant: actants.adjuvant ?? "",
          opposant: actants.opposant ?? "",
        }
      : null,
    costUsd,
  };
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

  if (refText.trim().length < 200 || candText.trim().length < 200) {
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
            ? "Finalisation…"
            : "Analyse de l'œuvre de référence et candidate en cours…";
          send({ type: "progress", percent, message });
        }

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

        const gRef = refOutcome.graph;
        const gCand = candOutcome.graph;
        const totalCost = refOutcome.usage.costUsd + candOutcome.usage.costUsd;
        const totalInputTokens = refOutcome.usage.inputTokens + candOutcome.usage.inputTokens;
        const totalOutputTokens = refOutcome.usage.outputTokens + candOutcome.usage.outputTokens;

        void recordUsage({
          ownerId,
          route: "compare",
          model: EXTRACTION_MODEL_ID,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        });

        const result = compare(gRef, gCand);

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
          costUsd: totalCost,
          refGraph: gRef,
          candGraph: gCand,
        });

        const pct = Math.round((result.sns ?? 0) * 100);
        const high = result.srjLevel === "Critique" || result.srjLevel === "Élevé";
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
            refWork: buildWork(gRef, refOutcome.usage.costUsd),
            candWork: buildWork(gCand, candOutcome.usage.costUsd),
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
