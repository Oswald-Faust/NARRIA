"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, MessageSquareText, ScanText, GitCompareArrows, History,
  FolderKanban, BookMarked, Settings, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoFull, LogoMark } from "@/components/brand/logo";

const MAIN_NAV = [
  { href: "/accueil", label: "Accueil", icon: Home },
  { href: "/chat", label: "NARR'IA Chat", icon: MessageSquareText, badge: "IA" },
  { href: "/analyser", label: "Analyser un texte", icon: ScanText },
  { href: "/comparer", label: "Comparer deux textes", icon: GitCompareArrows },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/projets", label: "Projet", icon: FolderKanban },
];

const BOTTOM_NAV = [
  { href: "/repertoire", label: "Répertoire", icon: BookMarked },
  { href: "/configuration", label: "Configuration", icon: Settings },
  { href: "/aide", label: "À propos", icon: Info },
];

const RECENTS = [
  "Aide-moi à structurer l'arc narratif…",
  "Quels droits protègent un scénario ?",
  "Comment construire une intrigue…",
  "Explique la différence entre…",
  "Génère un registre de dépôt…",
];

function NavLink({
  href, label, icon: Icon, badge, active, collapsed,
}: {
  href: string; label: string; icon: typeof Home; badge?: string;
  active: boolean; collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center rounded-xl text-sm font-medium transition-colors",
        collapsed ? "h-11 w-11 justify-center" : "gap-3 px-3 py-2.5",
        active ? "bg-accent text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge && (
            <span className="ml-auto rounded-full bg-soft-pink/30 px-2 py-0.5 text-[10px] font-bold text-soft-pink">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "bg-sidebar flex h-full shrink-0 flex-col py-5 transition-[width] duration-200",
        collapsed ? "w-20 items-center px-3" : "w-64 px-4",
      )}
    >
      {/* Logo */}
      <Link href="/accueil" className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "px-1")}>
        {collapsed ? (
          <LogoMark className="h-11" />
        ) : (
          <LogoFull className="h-[52px]" priority white />
        )}
      </Link>

      {/* Nav principale */}
      <nav className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </nav>

      {/* Récents */}
      {!collapsed && (
        <div className="mt-6 px-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">Récents</p>
          <ul className="space-y-2 border-l border-white/15 pl-3 text-xs text-white/55">
            {RECENTS.map((r) => (
              <li key={r} className="truncate hover:text-white/80">{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bas de sidebar */}
      <div className={cn("mt-auto pt-4", collapsed ? "flex w-full flex-col items-center" : "")}>
        {!collapsed && (
          <span className="mb-2 ml-3 inline-block rounded-full bg-purple/40 px-2.5 py-0.5 text-[10px] font-bold text-soft-purple">
            PRO
          </span>
        )}
        <nav className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          {BOTTOM_NAV.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
          ))}
        </nav>

        <div className={cn("mt-3 flex items-center rounded-xl bg-white/5", collapsed ? "h-11 w-11 justify-center" : "gap-3 px-3 py-2.5")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft-pink/30 text-sm font-bold text-soft-pink">
            D
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">ADEKAMBI David</p>
              <p className="truncate text-xs text-white/50">adekambidavid@gmail.com</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
