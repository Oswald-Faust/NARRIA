import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Comparison } from "@/lib/db/models/comparison";
import { tensionProfile } from "@/lib/engine";
import type { NarrativeGraph } from "@/lib/engine";
import { canAccessSession } from "@/lib/projects/permissions";

/** Reconstruit les infos par-œuvre du rapport depuis un graphe stocké (même logique que la route d'export). */
function buildWork(g: NarrativeGraph | undefined, fallbackTitle: string) {
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
    costUsd: typeof meta.costUsd === "number" ? meta.costUsd : 0,
  };
}

/** Récupère une comparaison sauvegardée pour l'afficher sur sa page dédiée (historique). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de comparaison invalide." }, { status: 400 });
  }

  await connectDB();
  const doc = await Comparison.findById(id).lean();
  if (!doc || !(await canAccessSession(doc.ownerId, doc.projectId ? String(doc.projectId) : null, session.user.id))) {
    return NextResponse.json({ error: "Comparaison introuvable." }, { status: 404 });
  }

  const gRef = doc.refGraph as NarrativeGraph | undefined;
  const gCand = doc.candGraph as NarrativeGraph | undefined;

  return NextResponse.json({
    id: String(doc._id),
    refTitle: doc.refTitle,
    candTitle: doc.candTitle,
    mode: doc.mode,
    costUsd: doc.costUsd,
    refWork: buildWork(gRef, doc.refTitle),
    candWork: buildWork(gCand, doc.candTitle),
    sns: doc.scores?.sns,
    snsNormalized: doc.snsNormalized ?? doc.scores?.snsNormalized,
    ss: doc.scores?.ss,
    st: doc.scores?.st,
    srj: doc.scores?.srj,
    srjLevel: doc.srjLevel,
    sIso: doc.scores?.sIso,
    sGed: doc.scores?.sGed,
    sFunc: doc.scores?.sFunc,
    sAct: doc.scores?.sAct,
    sTens: doc.scores?.sTens,
    detectedModality: doc.modality,
    verdict: doc.verdict,
    correspondences: doc.correspondences ?? [],
    warnings: doc.warnings ?? [],
    createdAt: doc.createdAt,
  });
}
