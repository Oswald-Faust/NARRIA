import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { analyzeHeuristic, functionSequence } from "@/lib/engine";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const text: string = body?.text ?? "";
  const title: string = body?.title || "Texte sans titre";
  const author: string = body?.author || "Auteur inconnu";

  if (text.trim().length < 200) {
    return NextResponse.json(
      { error: "Le texte doit contenir au moins 200 caractères (≈ 30 mots)." },
      { status: 400 },
    );
  }

  const graph = analyzeHeuristic(text, { title, author });
  const wordCount = text.trim().split(/\s+/).length;

  await connectDB();
  const doc = await Analysis.create({
    ownerId: session.user.id,
    title,
    author,
    mode: "heuristic",
    wordCount,
    nNodes: graph.nodes.length,
    graph,
  });

  await createNotification({
    ownerId: session.user.id,
    type: "analysis",
    title: `Analyse terminée — « ${title} »`,
    body: `L'analyse narrative de votre œuvre est prête. ${graph.nodes.length} nœuds narratifs détectés.`,
    href: "/historique",
  });

  return NextResponse.json({
    id: String(doc._id),
    title,
    author,
    nNodes: graph.nodes.length,
    wordCount,
    functionSequence: functionSequence(graph),
    nodes: graph.nodes,
  });
}
