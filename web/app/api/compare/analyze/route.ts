import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzeLLM, functionSequence, LlmExtractionError } from "@/lib/engine";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";
import { recordUsage } from "@/lib/usage";
import { describeExtractionProgress } from "@/lib/progress-messages";
import { resolveProjectLaunchContext } from "@/lib/projects/permissions";

export const runtime = "nodejs";
// Même contrainte que /api/analyze : un texte long peut dépasser 120s sur un seul appel LLM.
export const maxDuration = 300;

/**
 * Analyse individuelle d'une colonne de /comparer (« Analyser la référence / candidate »).
 *
 * Produit le graphe narratif d'un seul texte et le renvoie au client, SANS persister
 * d'analyse ni notification : le graphe est ensuite renvoyé tel quel à /api/compare pour
 * la comparaison finale, évitant une seconde passe LLM. L'usage/coût est tout de même tracé
 * (route « compare ») car l'appel LLM a bien lieu.
 */
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
  const title: string = body?.title || "Œuvre sans titre";
  const author: string = body?.author || "Auteur inconnu";

  const { error: projectError } = await resolveProjectLaunchContext(body?.projectId, session.user.id);
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
              `Analyse LLM (comparaison) échouée après un coût partiel de ${partial?.costUsd ?? 0} USD (${(partial?.inputTokens ?? 0) + (partial?.outputTokens ?? 0)} tokens).`,
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

        void recordUsage({
          ownerId,
          route: "compare",
          model: EXTRACTION_MODEL_ID,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        });

        const wordCount = text.trim().split(/\s+/).length;
        const meta = graph.metadata as Record<string, unknown>;

        send({
          type: "result",
          data: {
            // Graphe brut réutilisé par /api/compare (comparaison sans re-analyse LLM).
            graph,
            title,
            author,
            mode: "llm",
            nNodes: graph.nodes.length,
            wordCount,
            functionSequence: functionSequence(graph),
            // Détail complet de l'analyse, aligné sur AnalysisReportData.
            summary: meta.summary,
            genre: meta.genre,
            tradition: meta.tradition,
            mainActants: meta.mainActants,
            thematicKeywords: meta.thematicKeywords,
            nodes: graph.nodes,
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
