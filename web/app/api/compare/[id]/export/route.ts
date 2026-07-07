import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Comparison } from "@/lib/db/models/comparison";
import { tensionProfile } from "@/lib/engine";
import type { NarrativeGraph } from "@/lib/engine";
import {
  renderComparisonHtmlReport,
  type ComparisonReportWork,
} from "@/lib/reports/comparison-html-report";
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

/** Reconstruit les infos par-œuvre du rapport depuis un graphe stocké. */
function buildReportWork(g: NarrativeGraph | undefined, fallbackTitle: string): ComparisonReportWork {
  const meta = (g?.metadata ?? {}) as Record<string, unknown>;
  const actants = meta.main_actants_v1 as
    | { protagoniste?: string; objet?: string; destinateur?: string; destinataire?: string; adjuvant?: string; opposant?: string }
    | undefined;
  return {
    title: typeof meta.title === "string" ? meta.title : fallbackTitle,
    author: typeof meta.author === "string" ? meta.author : "Auteur inconnu",
    graphId: g?.graphId ?? "—",
    nNodes: Array.isArray(g?.nodes) ? g.nodes.length : 0,
    nEdges: Array.isArray(g?.edges) ? g.edges.length : 0,
    tensionProfile: Array.isArray(g?.nodes) ? tensionProfile(g) : [],
    mode: typeof meta.mode === "string" ? meta.mode : "heuristic",
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
    costUsd: typeof meta.costUsd === "number" ? meta.costUsd : undefined,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de comparaison invalide." }, { status: 400 });
  }
  const format = new URL(req.url).searchParams.get("format") ?? "html";
  if (format !== "html" && format !== "pdf") {
    return NextResponse.json({ error: "Format non supporté (html ou pdf)." }, { status: 400 });
  }

  await connectDB();
  const doc = await Comparison.findById(id).lean<{
    _id: unknown;
    ownerId: string;
    projectId?: unknown;
    refTitle?: string;
    candTitle?: string;
    scores?: Record<string, number | undefined>;
    snsNormalized?: number;
    srjLevel?: string;
    modality?: string;
    verdict?: string;
    correspondences?: Array<Record<string, unknown>>;
    warnings?: string[];
    refGraph?: NarrativeGraph;
    candGraph?: NarrativeGraph;
    createdAt?: Date;
  }>();
  if (!doc || !(await canAccessSession(doc.ownerId, doc.projectId ? String(doc.projectId) : null, session.user.id))) {
    return NextResponse.json({ error: "Comparaison introuvable." }, { status: 404 });
  }

  const refTitle = doc.refTitle ?? "Œuvre de référence";
  const candTitle = doc.candTitle ?? "Œuvre candidate";
  const refWork = buildReportWork(doc.refGraph, refTitle);
  const candWork = buildReportWork(doc.candGraph, candTitle);
  const scores = doc.scores ?? {};

  const correspondences = (doc.correspondences ?? []).map((c) => ({
    refNode: String(c.refNode ?? c.ref_node ?? "—"),
    refFunction: String(c.refFunction ?? c.ref_function ?? "—"),
    candNode: String(c.candNode ?? c.cand_node ?? "—"),
    candFunction: String(c.candFunction ?? c.cand_function ?? "—"),
    similarity: typeof c.similarity === "number" ? c.similarity : 0,
  }));

  const html = renderComparisonHtmlReport({
    dateHuman: new Date(doc.createdAt ?? new Date()).toLocaleString("fr-FR"),
    refWork,
    candWork,
    sns: scores.sns ?? 0,
    snsNormalized: doc.snsNormalized ?? scores.snsNormalized ?? 0,
    ss: scores.ss ?? 0,
    st: scores.st ?? 0,
    srj: scores.srj ?? 0,
    srjLevel: doc.srjLevel ?? "—",
    sIso: scores.sIso ?? 0,
    sGed: scores.sGed ?? 0,
    sFunc: scores.sFunc ?? 0,
    sAct: scores.sAct ?? 0,
    sTens: scores.sTens ?? 0,
    detectedModality: doc.modality ?? "—",
    verdict: doc.verdict ?? "",
    correspondences,
    warnings: doc.warnings ?? [],
  });

  const filename = `${slugify(`${refTitle}_vs_${candTitle}`)}_${doc._id}`;

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
