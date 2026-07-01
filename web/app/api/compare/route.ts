import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Comparison } from "@/lib/db/models/comparison";
import { analyzeHeuristic, compare } from "@/lib/engine";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const refText: string = body?.refText ?? "";
  const candText: string = body?.candText ?? "";
  const refTitle: string = body?.refTitle || "Œuvre de référence";
  const candTitle: string = body?.candTitle || "Œuvre candidate";

  if (refText.trim().length < 200 || candText.trim().length < 200) {
    return NextResponse.json(
      { error: "Chaque texte doit contenir au moins 200 caractères." },
      { status: 400 },
    );
  }

  const gRef = analyzeHeuristic(refText, { title: refTitle });
  const gCand = analyzeHeuristic(candText, { title: candTitle });
  const result = compare(gRef, gCand);

  await connectDB();
  const doc = await Comparison.create({
    ownerId: session.user.id,
    refTitle,
    candTitle,
    mode: "heuristic",
    scores: {
      sns: result.sns, ss: result.ss, st: result.st, srj: result.srj,
      sIso: result.sIso, sGed: result.sGed, sFunc: result.sFunc,
      sAct: result.sAct, sTens: result.sTens,
    },
    srjLevel: result.srjLevel,
    modality: result.detectedModality,
    verdict: result.verdict,
    correspondences: result.correspondences,
    warnings: result.warnings,
  });

  const pct = Math.round((result.sns ?? 0) * 100);
  const high = result.srjLevel === "Critique" || result.srjLevel === "Élevé";
  await createNotification({
    ownerId: session.user.id,
    type: high ? "ip" : "comparison",
    title: high
      ? `Similarité élevée détectée — ${refTitle} / ${candTitle}`
      : `Comparaison terminée — ${refTitle} / ${candTitle}`,
    body: `Indice de similarité narrative : ${pct} %. Niveau de risque : ${result.srjLevel}.`,
    href: "/historique",
  });

  return NextResponse.json({ id: String(doc._id), refTitle, candTitle, ...result });
}
