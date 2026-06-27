"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageSquareText } from "lucide-react";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");
  const [items, setItems] = useState<RecentConversation[]>([]);

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

  return (
    <div className="mt-5">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Récents
      </p>
      <div className="space-y-1">
        {items.slice(0, 5).map((item) => {
          const active = pathname === "/chat" && activeId === item.id;
          return (
            <Link
              key={item.id}
              href={`/chat?c=${item.id}`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-white/12 text-white" : "text-white/72 hover:bg-white/8 hover:text-white",
              )}
            >
              <span className={cn("h-10 w-0.5 rounded-full", active ? "bg-soft-pink" : "bg-white/15")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 shrink-0 text-soft-pink" />
                  <span className="truncate">{item.title}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
