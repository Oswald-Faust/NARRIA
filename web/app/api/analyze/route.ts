import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { analyzeLLM, functionSequence, LlmExtractionError } from "@/lib/engine";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";
import { createNotification } from "@/lib/notifications";
import { recordUsage } from "@/lib/usage";
import { describeExtractionProgress } from "@/lib/progress-messages";
import { resolveProjectLaunchContext } from "@/lib/projects/permissions";

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

  const { projectId, error: projectError } = await resolveProjectLaunchContext(body?.projectId, session.user.id);
  if (projectError) {
    return NextResponse.json({ error: projectError }, { status: 403 });
  }

  if (text.trim().length < 200) {
    return NextResponse.json(
      { error: "Le texte doit contenir au moins 200 caractères (≈ 30 mots)." },
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
        let graph;
        let usage;
        try {
          ({ graph, usage } = await analyzeLLM(text, { title, author }, (event) => {
            const percent = Math.round(event.fraction * 100);
            const message =
              event.stage === "merging"
                ? "Fusion des blocs analysés…"
                : event.stage === "done"
                  ? "Analyse via IA terminée…"
                  : describeExtractionProgress(percent, event.chunkIndex, event.chunkTotal);
            send({ type: "progress", percent, message });
          }));
        } catch (e) {
          let partial: { inputTokens?: number; outputTokens?: number; costUsd?: number } | undefined;
          if (e instanceof LlmExtractionError) {
            partial = e.partialUsage;
            console.error(
              `Analyse LLM échouée après un coût partiel de ${partial?.costUsd ?? 0} USD (${(partial?.inputTokens ?? 0) + (partial?.outputTokens ?? 0)} tokens).`,
            );
          }
          const message = e instanceof Error ? e.message : "Erreur lors de l'analyse LLM.";
          void recordUsage({
            ownerId,
            route: "analyze",
            model: EXTRACTION_MODEL_ID,
            inputTokens: partial?.inputTokens ?? 0,
            outputTokens: partial?.outputTokens ?? 0,
            success: false,
            error: message,
          });
          send({ type: "error", error: message, status: 502 });
          return;
        }

        send({ type: "progress", percent: 99, message: "Enregistrement de l'analyse…" });

        const wordCount = text.trim().split(/\s+/).length;
        const meta = graph.metadata as Record<string, unknown>;

        await connectDB();
        const doc = await Analysis.create({
          ownerId,
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
          projectId,
        });

        await createNotification({
          ownerId,
          type: "analysis",
          title: `Analyse terminée — « ${title} »`,
          body: `L'analyse narrative de votre œuvre est prête. ${graph.nodes.length} nœuds narratifs détectés.`,
          href: "/historique",
        });

        void recordUsage({
          ownerId,
          route: "analyze",
          model: EXTRACTION_MODEL_ID,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        });

        send({
          type: "result",
          data: {
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
