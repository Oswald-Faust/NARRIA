import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { functionSequence } from "@/lib/engine";
import type { NarrativeGraph } from "@/lib/engine";
import { canAccessSession } from "@/lib/projects/permissions";

/** Récupère une analyse sauvegardée pour l'afficher sur sa page dédiée (historique). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant d'analyse invalide." }, { status: 400 });
  }

  await connectDB();
  const doc = await Analysis.findById(id).lean();
  if (!doc || !(await canAccessSession(doc.ownerId, doc.projectId ? String(doc.projectId) : null, session.user.id))) {
    return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
  }

  const graph = doc.graph as NarrativeGraph;

  return NextResponse.json({
    id: String(doc._id),
    title: doc.title,
    author: doc.author,
    mode: doc.mode,
    nNodes: doc.nNodes,
    wordCount: doc.wordCount,
    functionSequence: functionSequence(graph),
    nodes: graph.nodes,
    summary: doc.summary,
    genre: doc.genre,
    tradition: doc.tradition,
    mainActants: doc.mainActants,
    thematicKeywords: doc.thematicKeywords,
    costUsd: doc.costUsd,
    tokensTotal: doc.costTokens,
    createdAt: doc.createdAt,
  });
}
