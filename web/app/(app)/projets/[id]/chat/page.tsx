import { Suspense } from "react";
import { ChatTool } from "@/components/chat/chat-tool";
import { LoadingBlock } from "@/components/ui/spinner";

/**
 * NARR'IA Chat monté à l'intérieur du projet : les conversations créées y sont rattachées,
 * et la navigation (nouveau chat, ouverture d'une conversation) reste sous /projets/[id]/chat.
 */
export default async function ProjectChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ChatTool projectId={id} basePath={`/projets/${id}/chat`} />
    </Suspense>
  );
}
