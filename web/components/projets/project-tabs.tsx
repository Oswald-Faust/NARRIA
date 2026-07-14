"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScanText, GitCompareArrows, MessageSquare, Users } from "lucide-react";

/**
 * Navigation interne d'un projet : les outils vivent DANS le projet
 * (/projets/[id]/analyser, /comparer, /chat) — on ne quitte jamais son contexte.
 */
export function ProjectTabs({ id, role }: { id: string; role: string }) {
  const pathname = usePathname();
  const base = `/projets/${id}`;
  const canLaunch = role === "owner" || role === "co-admin" || role === "collaborateur";
  const canManage = role === "owner" || role === "co-admin";

  const tabs = [
    { href: base, label: "Vue d'ensemble", icon: LayoutDashboard, show: true },
    { href: `${base}/analyser`, label: "Analyser un texte", icon: ScanText, show: canLaunch },
    { href: `${base}/comparer`, label: "Comparer deux textes", icon: GitCompareArrows, show: canLaunch },
    { href: `${base}/chat`, label: "NARR'IA Chat", icon: MessageSquare, show: true },
    { href: `${base}/membres`, label: "Collaborateurs", icon: Users, show: canManage },
  ].filter((t) => t.show);

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-1.5">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
