"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { Sparkles, ThumbsUp, Copy, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { ToolPart } from "./tool-part";

/** Avatar dégradé de l'assistant (carré violet→rose à étincelle). */
export function AssistantAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-pink text-white shadow-sm">
      <Sparkles className="h-[18px] w-[18px]" />
    </div>
  );
}

function plainText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n\n");
}

export function ChatMessage({
  message,
  isLast,
  onRegenerate,
}: {
  message: UIMessage;
  isLast: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  function copy() {
    navigator.clipboard.writeText(plainText(message));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-sm">
          {plainText(message)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3.5 shadow-sm">
          <div className="space-y-3">
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return <Markdown key={i}>{(part as { text: string }).text}</Markdown>;
              }
              if (part.type.startsWith("tool-")) {
                return (
                  <ToolPart
                    key={i}
                    type={part.type}
                    state={(part as { state: string }).state}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>

        {/* Barre d'actions */}
        <div className="flex items-center gap-1 pl-1">
          <ActionButton onClick={copy} icon={copied ? Check : Copy} label={copied ? "Copié" : "Copier"} />
          <ActionButton icon={ThumbsUp} label="Utile" />
          {isLast && onRegenerate && (
            <ActionButton onClick={onRegenerate} icon={RotateCcw} label="Régénérer" />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors",
        "hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
