"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, MessageSquareText, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export function RecentConversations({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");
  const [items, setItems] = useState<RecentConversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = () =>
      fetch("/api/chat/conversations")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active) setItems(d?.conversations ?? []);
        })
        .catch(() => {
          if (active) setItems([]);
        });

    refresh();
    window.addEventListener("chat:updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("chat:updated", refresh);
    };
  }, [pathname]);

  if (collapsed || items.length === 0) return null;

  function startEdit(item: RecentConversation) {
    setEditingId(item.id);
    setDraftTitle(item.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftTitle("");
  }

  async function renameConversation(id: string) {
    const title = draftTitle.trim();
    if (!title) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) return;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, title } : item)));
      cancelEdit();
      window.dispatchEvent(new Event("chat:updated"));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteConversation(item: RecentConversation) {
    if (!window.confirm(`Supprimer la conversation « ${item.title} » ?`)) return;

    setBusyId(item.id);
    try {
      const res = await fetch(`/api/chat/conversations/${item.id}`, { method: "DELETE" });
      if (!res.ok) return;

      setItems((prev) => prev.filter((conversation) => conversation.id !== item.id));
      if (editingId === item.id) cancelEdit();
      window.dispatchEvent(new Event("chat:updated"));
      if (pathname === "/chat" && activeId === item.id) router.replace("/chat");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-5">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Récents
      </p>
      <div className="space-y-1">
        {items.slice(0, 5).map((item) => {
          const active = pathname === "/chat" && activeId === item.id;
          const editing = editingId === item.id;
          const busy = busyId === item.id;
          return (
            <div
              key={item.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-white/12 text-white" : "text-white/72 hover:bg-white/8 hover:text-white",
              )}
            >
              <span className={cn("h-10 w-0.5 rounded-full", active ? "bg-soft-pink" : "bg-white/15")} />
              {editing ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameConversation(item.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    disabled={busy}
                    autoFocus
                    className="h-8 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-soft-pink/70"
                  />
                  <button
                    type="button"
                    onClick={() => renameConversation(item.id)}
                    disabled={busy || !draftTitle.trim()}
                    aria-label="Enregistrer le nom"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={busy}
                    aria-label="Annuler"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href={`/chat?c=${item.id}`}
                    onClick={onNavigate}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <MessageSquareText className="h-4 w-4 shrink-0 text-soft-pink" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={busy}
                      aria-label={`Renommer ${item.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConversation(item)}
                      disabled={busy}
                      aria-label={`Supprimer ${item.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 hover:bg-red-400/15 hover:text-red-300 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
