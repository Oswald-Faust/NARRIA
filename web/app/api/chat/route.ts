import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  stepCountIs,
  type UIMessage,
} from "ai";
import { auth } from "@/auth";
import {
  chatModel,
  CHAT_MODEL_ID,
  narriaTools,
  SYSTEM_PROMPT,
  MAX_STEPS,
} from "@/lib/chat/agent";
import { recordUsage } from "@/lib/usage";

// Streaming long : on reste sur le runtime Node (défaut), pas Edge.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Authentification requise" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "Clé ANTHROPIC_API_KEY manquante côté serveur. Renseignez-la dans .env.local (et dans les variables d'environnement Vercel).",
      },
      { status: 503 },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();
  const ownerId = session.user.id;

  const result = streamText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: narriaTools,
    stopWhen: stepCountIs(MAX_STEPS),
    onFinish: ({ totalUsage }) => {
      // Trace tokens + coût estimé pour le dashboard admin (best-effort).
      const cached = (totalUsage as { cachedInputTokens?: number } | undefined)?.cachedInputTokens ?? 0;
      void recordUsage({
        ownerId,
        route: "chat",
        model: CHAT_MODEL_ID,
        inputTokens: totalUsage?.inputTokens ?? 0,
        outputTokens: totalUsage?.outputTokens ?? 0,
        cachedInputTokens: cached,
      });
    },
    onError: ({ error }) => {
      void recordUsage({
        ownerId,
        route: "chat",
        model: CHAT_MODEL_ID,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
