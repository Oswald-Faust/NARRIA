"use client";

import { useEffect, useState } from "react";
import { LogIn, ScanText, GitCompareArrows, MessageSquareText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingBlock } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface Event {
  type: "login" | "analysis" | "comparison" | "chat";
  email: string; label: string; detail: string; success: boolean; createdAt: string;
}

const ICONS = {
  login: { icon: LogIn, cls: "bg-emerald-500/15 text-emerald-400" },
  analysis: { icon: ScanText, cls: "bg-sky-500/15 text-sky-400" },
  comparison: { icon: GitCompareArrows, cls: "bg-soft-pink/15 text-soft-pink" },
  chat: { icon: MessageSquareText, cls: "bg-soft-purple/15 text-soft-purple" },
};

const fmt = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`;
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function AdminActivityPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/activity")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEvents(d?.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="p-0">
      <h3 className="border-b border-border px-5 py-3 font-heading text-sm font-bold">Journal d&apos;activité (60 derniers évènements)</h3>
      {loading ? (
        <LoadingBlock />
      ) : events.length === 0 ? (
        <p className="p-5 text-sm text-muted">Aucune activité enregistrée.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {events.map((e, i) => {
            const cfg = ICONS[e.type];
            const Icon = cfg.icon;
            return (
              <li key={i} className="flex items-start gap-3 px-5 py-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", cfg.cls)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className={cn("font-semibold", e.success ? "text-foreground" : "text-red-400")}>{e.label}</span>
                    <span className="text-muted"> — {e.detail}</span>
                  </p>
                  <p className="text-xs text-muted">{e.email}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">{fmt(e.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
