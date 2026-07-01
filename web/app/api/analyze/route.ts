import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { analyzeLLM, functionSequence, LlmExtractionError } from "@/lib/engine";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  const text: string = body?.text ?? "";
  const title: string = body?.title || "Texte sans titre";
  const author: string = body?.author || "Auteur inconnu";
  const sourceFile = body?.sourceFile ?? null;

  if (text.trim().length < 200) {
    return NextResponse.json(
      { error: "Le texte doit contenir au moins 200 caractères (≈ 30 mots)." },
      { status: 400 },
    );
  }

  let graph;
  let usage;
  try {
    ({ graph, usage } = await analyzeLLM(text, { title, author }));
  } catch (e) {
    if (e instanceof LlmExtractionError) {
      const partial = e.partialUsage;
      console.error(
        `Analyse LLM échouée après un coût partiel de ${partial?.costUsd ?? 0} USD (${(partial?.inputTokens ?? 0) + (partial?.outputTokens ?? 0)} tokens).`,
      );
    }
    const message = e instanceof Error ? e.message : "Erreur lors de l'analyse LLM.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const wordCount = text.trim().split(/\s+/).length;
  const meta = graph.metadata as Record<string, unknown>;

  await connectDB();
  const doc = await Analysis.create({
    ownerId: session.user.id,
    title,
    author,
    mode: "llm",
    wordCount,
    nNodes: graph.nodes.length,
    graph,
    costTokens: usage.inputTokens + usage.outputTokens,
    costUsd: usage.costUsd,
    summary: meta.summary,
    genre: meta.genre,
    tradition: meta.tradition,
    mainActants: meta.mainActants,
    thematicKeywords: meta.thematicKeywords,
    formalFeatures: meta.formalFeatures,
    sourceFile,
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
    mode: "llm",
    nNodes: graph.nodes.length,
    wordCount,
    functionSequence: functionSequence(graph),
    nodes: graph.nodes,
    summary: meta.summary,
    genre: meta.genre,
    tradition: meta.tradition,
    mainActants: meta.mainActants,
    thematicKeywords: meta.thematicKeywords,
    costUsd: usage.costUsd,
    tokensTotal: usage.inputTokens + usage.outputTokens,
  });
}
