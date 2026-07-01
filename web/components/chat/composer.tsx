"use client";

import { useRef, useEffect } from "react";
import { Paperclip, FileText, Mic, ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Zone de saisie du chat — textarea auto-extensible, actions secondaires
 * (pièce jointe, document, micro) et bouton d'envoi / arrêt.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  placeholder = "Posez votre prochaine question à NARR'IA…",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  busy: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !busy) onSubmit();
    }
  }

  const canSend = value.trim().length > 0 && !busy;

  return (
    <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm focus-within:ring-2 focus-within:ring-accent/30">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="block max-h-[200px] w-full resize-none bg-transparent px-3 pt-2 pb-1 text-sm leading-6 text-foreground placeholder:text-muted focus:outline-none"
      />
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-0.5">
          <IconBtn icon={Paperclip} title="Joindre un fichier" />
          <IconBtn icon={FileText} title="Insérer un document" />
        </div>
        <div className="flex items-center gap-1">
          <IconBtn icon={Mic} title="Dicter" />
          {busy ? (
            <button
              onClick={onStop}
              title="Arrêter"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-border"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => canSend && onSubmit()}
              disabled={!canSend}
              title="Envoyer"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors",
                canSend
                  ? "bg-gradient-to-br from-purple to-pink hover:opacity-90"
                  : "cursor-not-allowed bg-surface-2 text-muted",
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, title }: { icon: typeof Mic; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
