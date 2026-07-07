import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { renderAnalysisHtmlReport } from "@/lib/reports/analysis-html-report";
import { canAccessSession } from "@/lib/projects/permissions";

export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "rapport"
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant d'analyse invalide." }, { status: 400 });
  }
  const format = new URL(req.url).searchParams.get("format") ?? "html";
  if (format !== "html" && format !== "pdf") {
    return NextResponse.json({ error: "Format non supporté (html ou pdf)." }, { status: 400 });
  }

  await connectDB();
  const doc = await Analysis.findById(id).lean();
  if (!doc || !(await canAccessSession(doc.ownerId, doc.projectId ? String(doc.projectId) : null, session.user.id))) {
    return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
  }

  const graph = doc.graph as { nodes: Array<Record<string, unknown>> };
  const html = renderAnalysisHtmlReport({
    title: doc.title,
    author: doc.author,
    mode: doc.mode,
    summary: doc.summary,
    genre: doc.genre,
    tradition: doc.tradition,
    mainActants: doc.mainActants ?? undefined,
    thematicKeywords: doc.thematicKeywords,
    nodes: (graph.nodes ?? []).map((n) => ({
      nodeId: n.nodeId as string,
      functionCode: n.functionCode as string | null,
      functionName: n.functionName as string | null,
      functionFamily: n.functionFamily as string | null,
      actants: (n.actants as string[]) ?? [],
      modalities: n.modalities as { vouloir: number; devoir: number; pouvoir: number; savoir: number },
      tension: n.tension as number,
      phase: n.phase as string | null,
      textExcerpt: n.textExcerpt as string,
    })),
    costUsd: doc.costUsd,
    tokensTotal: doc.costTokens,
    dateHuman: new Date(doc.createdAt as Date).toLocaleString("fr-FR"),
  });

  const filename = `${slugify(doc.title)}_${doc._id}`;

  if (format === "html") {
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.html"`,
      },
    });
  }

  const { htmlToPdf } = await import("@/lib/reports/pdf");
  let pdf: Buffer;
  try {
    pdf = await htmlToPdf(html);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue lors de la génération du PDF.";
    console.error("[export] Génération PDF échouée:", message);
    return NextResponse.json(
      { error: "Génération du PDF impossible pour le moment. Réessayez ou téléchargez le format HTML." },
      { status: 500 },
    );
  }
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}
