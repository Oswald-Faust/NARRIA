"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, KeyRound, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/admin/api", label: "API & Coûts", icon: KeyRound },
  { href: "/admin/activite", label: "Activité", icon: Activity },
];

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface p-1">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            isActive(href) ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </div>
  );
}
