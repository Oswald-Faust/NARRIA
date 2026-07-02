import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Comparison } from "@/lib/db/models/comparison";
import { analyzeLLM, compare, LlmExtractionError } from "@/lib/engine";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";
import { createNotification } from "@/lib/notifications";
import { recordUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 180;

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

  let refOutcome;
  let candOutcome;
  try {
    refOutcome = await analyzeLLM(refText, { title: refTitle, author: refAuthor });
    candOutcome = await analyzeLLM(candText, { title: candTitle, author: candAuthor });
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
    return NextResponse.json({ error: message }, { status: 502 });
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

  return NextResponse.json({ id: String(doc._id), refTitle, candTitle, mode: "llm", costUsd: totalCost, ...result });
}
