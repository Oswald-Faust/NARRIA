"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Sparkles, Plus, TriangleAlert } from "lucide-react";
import { ChatMessage, AssistantAvatar } from "@/components/chat/chat-message";
import { Composer } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";

const STORAGE_KEY = "narria.chat.messages";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const hydratedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, regenerate, error, setMessages } =
    useChat();

  // Restaure la conversation persistée (localStorage) après hydratation.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw) as UIMessage[]);
    } catch {
      /* ignore */
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste à chaque changement (une fois hydraté). La suppression est gérée
  // explicitement par « Nouveau chat » pour ne pas écraser au montage.
  useEffect(() => {
    if (!hydratedRef.current || messages.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Défilement automatique vers le bas.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  }

  function newChat() {
    stop();
    setMessages([]);
    setInput("");
    localStorage.removeItem(STORAGE_KEY);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* En-tête de conversation */}
      <div className="flex items-center justify-between pb-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-soft-purple" />
          NARR&apos;IA Chat
        </span>
        <button
          onClick={newChat}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-purple/85"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau chat
        </button>
      </div>

      {/* Fil de discussion */}
      <div className="flex flex-1 flex-col">
        {isEmpty ? (
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
