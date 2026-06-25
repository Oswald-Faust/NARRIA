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
  narriaTools,
  SYSTEM_PROMPT,
  MAX_STEPS,
} from "@/lib/chat/agent";

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

  const result = streamText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: narriaTools,
    stopWhen: stepCountIs(MAX_STEPS),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
