"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatTool } from "@/components/chat/chat-tool";
import { LoadingBlock } from "@/components/ui/spinner";

function ChatPageInner() {
  const projectId = useSearchParams().get("projectId");
  return <ChatTool projectId={projectId} basePath="/chat" />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ChatPageInner />
    </Suspense>
  );
}
