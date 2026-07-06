"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Sparkles, Plus, TriangleAlert } from "lucide-react";
import { ChatMessage, AssistantAvatar } from "@/components/chat/chat-message";
import { Composer } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";

function titleFromMessages(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser?.parts
    ?.filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join(" ")
    .trim() ?? "";

  const normalized = text.replace(/\s+/g, " ");
  if (!normalized) return "Nouvelle conversation";
  return normalized.length > 48 ? `${normalized.slice(0, 48).trimEnd()}…` : normalized;
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");
  const projectId = searchParams.get("projectId");
  const [input, setInput] = useState("");
  const [loadedTitle, setLoadedTitle] = useState("Nouvelle conversation");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const hydratedConversationRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, regenerate, error, setMessages } =
    useChat();

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      hydratedConversationRef.current = "new";
      window.setTimeout(() => {
        setLoadingConversation(false);
      }, 0);
      window.setTimeout(() => {
        setLoadedTitle("Nouvelle conversation");
      }, 0);
      return;
    }

    let active = true;
    window.setTimeout(() => {
      if (active) setLoadingConversation(true);
    }, 0);

    fetch(`/api/chat/conversations/${conversationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        setMessages((data?.conversation?.messages ?? []) as UIMessage[]);
        setLoadedTitle(data?.conversation?.title ?? "Nouvelle conversation");
        setLoadingConversation(false);
        hydratedConversationRef.current = conversationId;
      })
      .catch(() => {
        if (!active) return;
        setMessages([]);
        setLoadedTitle("Nouvelle conversation");
        setLoadingConversation(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || hydratedConversationRef.current !== conversationId) return;
    if (status !== "ready") return;

    const nextTitle = titleFromMessages(messages);

    const timer = window.setTimeout(() => {
      fetch(`/api/chat/conversations/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, title: nextTitle }),
      })
        .then(() => {
          window.dispatchEvent(new Event("chat:updated"));
        })
        .catch(() => {});
    }, 250);

    return () => window.clearTimeout(timer);
  }, [conversationId, messages, status]);

  // Défilement automatique vers le bas.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const displayTitle = messages.length > 0 ? titleFromMessages(messages) : loadedTitle;

  async function ensureConversation(seed: string) {
    if (conversationId) return conversationId;

    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: seed, projectId }),
    });
    const data = await res.json().catch(() => null);
    const id = data?.conversation?.id as string | undefined;
    if (!res.ok || !id) throw new Error(data?.error || "Création de conversation impossible");

    setLoadedTitle(data.conversation.title ?? "Nouvelle conversation");
    hydratedConversationRef.current = id;
    router.replace(`/chat?c=${id}`);
    window.dispatchEvent(new Event("chat:updated"));
    return id;
  }

  async function submit(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    try {
      await ensureConversation(t);
    } catch {
      return;
    }
    sendMessage({ text: t });
    setInput("");
  }

  function newChat() {
    stop();
    setMessages([]);
    setInput("");
    setLoadedTitle("Nouvelle conversation");
    hydratedConversationRef.current = "new";
    router.push("/chat");
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* En-tête de conversation */}
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-soft-purple" />
            NARR&apos;IA Chat
          </span>
          <p className="text-sm font-semibold text-foreground">{displayTitle}</p>
        </div>
        <button
          onClick={newChat}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-purple/85"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau chat
        </button>
      </div>

      {/* Fil de discussion */}
      <div className="flex flex-1 flex-col">
        {loadingConversation ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-sm text-muted">
            Chargement de la conversation…
          </div>
        ) : isEmpty ? (
          <EmptyState onPick={submit} />
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map((m, i) => (
              <ChatMessage
                key={m.id}
                message={m}
                isLast={i === messages.length - 1 && m.role === "assistant" && !busy}
                onRegenerate={() => regenerate()}
              />
            ))}

            {/* Indicateur de réflexion avant le premier token */}
            {status === "submitted" && (
              <div className="flex gap-3">
                <AssistantAvatar />
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-4">
                  <Dot /> <Dot /> <Dot />
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Une erreur est survenue : {error.message}. Vérifiez que la clé
            ANTHROPIC_API_KEY est configurée, puis réessayez.
          </span>
        </div>
      )}

      {/* Zone de saisie (collée en bas) */}
      <div className="sticky bottom-0 bg-background pb-1 pt-2">
        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => submit(input)}
          onStop={stop}
          busy={busy}
        />
        <p className="mt-2 text-center text-[11px] text-muted">
          NARR&apos;IA est un expert IA spécialisé — ses analyses ne remplacent pas
          un conseil juridique professionnel.
        </p>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="h-2 w-2 animate-bounce rounded-full bg-soft-purple [animation-delay:var(--d)] [&:nth-child(2)]:[--d:120ms] [&:nth-child(3)]:[--d:240ms]" />
  );
}
