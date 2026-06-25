"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, LayoutDashboard, HelpCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const onDashboard = pathname.startsWith("/dashboard");
  const onAide = pathname.startsWith("/aide");

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/70 px-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <p className="font-display text-base font-semibold text-foreground">Bonjour, David !</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Segment Dashboard / Aide */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
          <Link
            href="/dashboard"
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

        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
            3
          </span>
        </button>
      </div>
    </header>
  );
}
