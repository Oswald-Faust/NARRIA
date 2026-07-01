"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ScanText, GitCompareArrows, ShieldAlert, Library, CircleCheck,
  Bell, CheckCheck,
} from "lucide-react";
import { koba } from "@/lib/fonts";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: "analysis" | "comparison" | "ip" | "repertoire" | "export" | "system";
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<
  NotificationItem["type"],
  { icon: typeof Bell; wrap: string; fg: string }
> = {
  analysis:   { icon: ScanText,          wrap: "bg-soft-purple/15", fg: "text-soft-purple" },
  comparison: { icon: GitCompareArrows,  wrap: "bg-soft-pink/15",   fg: "text-soft-pink" },
  ip:         { icon: ShieldAlert,       wrap: "bg-amber-500/15",   fg: "text-amber-500" },
  repertoire: { icon: Library,           wrap: "bg-soft-purple/15", fg: "text-soft-purple" },
  export:     { icon: CircleCheck,       wrap: "bg-emerald-500/15", fg: "text-emerald-400" },
  system:     { icon: Bell,              wrap: "bg-surface-2",      fg: "text-muted" },
};

const PERIODS = [
  { key: "all", label: "Tout" },
  { key: "today", label: "Aujourd'hui" },
  { key: "7d", label: "7 derniers jours" },
  { key: "30d", label: "30 derniers jours" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const STATUSES = [
  { key: "all", label: "Tous" },
  { key: "unread", label: "Non lus" },
  { key: "read", label: "Lus" },
] as const;
type StatusKey = (typeof STATUSES)[number]["key"];

/** Horodatage relatif en français façon maquette. */
function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} minute${min > 1 ? "s" : ""}`;

  const sameDay = d.toDateString() === now.toDateString();
  const hhmm = `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) {
    const h = Math.floor(min / 60);
    return `Il y a ${h} heure${h > 1 ? "s" : ""}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Hier, ${hhmm}`;

  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}, ${hhmm}`;
}

function withinPeriod(iso: string, period: PeriodKey): boolean {
  if (period === "all") return true;
  const d = new Date(iso);
  const now = new Date();
  if (period === "today") return d.toDateString() === now.toDateString();
  const days = period === "7d" ? 7 : 30;
  return now.getTime() - d.getTime() <= days * 86400000;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [status, setStatus] = useState<StatusKey>("all");

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(d?.notifications ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (n) =>
          withinPeriod(n.createdAt, period) &&
          (status === "all" || (status === "unread" ? !n.read : n.read)),
      ),
    [items, period, status],
  );

  const unreadCount = items.filter((n) => !n.read).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    window.dispatchEvent(new Event("notifications:updated"));
  }

  async function openNotification(n: NotificationItem) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
      window.dispatchEvent(new Event("notifications:updated"));
    }
    if (n.href) router.push(n.href);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4">
        <h1 className={`${koba.className} text-2xl font-semibold tracking-wide text-foreground sm:text-3xl`}>
          Notifications
        </h1>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted">Période :</span>
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  period === p.key
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                status === s.key ? "bg-surface-2 text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {s.key === "unread" && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              {s.key === "read" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface p-8 text-center text-muted">
          Chargement…
        </p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border bg-surface p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
            <Bell className="h-6 w-6" />
          </div>
          <p className="font-heading text-base font-bold text-foreground">Aucune notification</p>
          <p className="max-w-sm text-sm text-muted">
            Vos analyses, comparaisons et alertes apparaîtront ici dès qu&apos;un événement se produit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const cfg = ICONS[n.type] ?? ICONS.system;
            const Icon = cfg.icon;
            return (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-[var(--radius-card)] border bg-surface px-5 py-4 text-left transition-colors hover:border-soft-pink/40",
                  n.read ? "border-border" : "border-soft-pink/30 bg-soft-pink/[0.03]",
                )}
              >
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", cfg.wrap)}>
                  <Icon className={cn("h-5 w-5", cfg.fg)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-bold text-foreground">{n.title}</p>
                  {n.body && <p className="mt-1 text-sm leading-6 text-muted">{n.body}</p>}
                  <p className="mt-1.5 text-xs text-muted/70">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
