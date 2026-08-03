"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, Menu, LayoutDashboard, HelpCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import type { ShellUser } from "./types";

export function Topbar({
  collapsed,
  onToggleCollapse,
  onOpenMobile,
  user,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
  user: ShellUser;
}) {
  const pathname = usePathname();
  const onDashboard = pathname.startsWith("/accueil");
  const onAide = pathname.startsWith("/aide");
  const onNotifications = pathname.startsWith("/notifications");

  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (active && d) setUnread(d.unreadCount ?? 0); })
        .catch(() => {});

    refresh();
    window.addEventListener("notifications:updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("notifications:updated", refresh);
    };
  }, [pathname]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface/70 px-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* Hamburger mobile */}
        <button
          onClick={onOpenMobile}
          aria-label="Ouvrir le menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Repli desktop */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground lg:flex"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <p className="truncate font-display text-base font-semibold text-foreground">
          Bonjour, {user.firstName} !
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Formule en cours — mène au détail de l'abonnement (page Profil). */}
        <Link
          href="/profil"
          aria-label="Votre formule : PRO — voir l'abonnement"
          className="rounded-full bg-purple/40 px-2.5 py-1 text-[10px] font-bold tracking-wide text-soft-purple transition-colors hover:bg-purple/60 hover:text-white"
        >
          PRO
        </Link>

        {/* Segment Dashboard / Aide — masqué sur petits écrans */}
        <div className="hidden items-center gap-1 rounded-full border border-border bg-surface p-1 md:flex">
          <Link
            href="/accueil"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              onDashboard ? "bg-surface-2 text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            href="/aide"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              onAide ? "bg-surface-2 text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            <HelpCircle className="h-4 w-4" /> Aide
          </Link>
        </div>

        <ThemeToggle />

        <Link
          href="/notifications"
          aria-label="Notifications"
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface",
            onNotifications ? "text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
