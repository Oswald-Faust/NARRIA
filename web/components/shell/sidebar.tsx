"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquareText,
  ScanText,
  GitCompareArrows,
  History,
  FolderKanban,
  BookMarked,
  Settings,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN_NAV = [
  { href: "/accueil", label: "Accueil", icon: Home },
  { href: "/chat", label: "NARR'IA Chat", icon: MessageSquareText },
  { href: "/analyser", label: "Analyser un texte", icon: ScanText },
  { href: "/comparer", label: "Comparer deux textes", icon: GitCompareArrows },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/projets", label: "Projets", icon: FolderKanban },
];

const BOTTOM_NAV = [
  { href: "/repertoire", label: "Répertoire", icon: BookMarked },
  { href: "/configuration", label: "Configuration", icon: Settings },
  { href: "/aide", label: "À propos", icon: Info },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-white shadow-sm"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-gradient-to-b from-[#3a1d63] via-[#2b1650] to-[#1a0e35] px-4 py-5">
      {/* Logo */}
      <Link href="/accueil" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-white">
          n
        </div>
        <span className="font-heading text-xl font-bold text-white">
          narr&apos;ia
        </span>
      </Link>

      {/* Nav principale */}
      <nav className="space-y-1">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      {/* Récents */}
      <div className="mt-6 px-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
          Récents
        </p>
        <ul className="space-y-1.5 text-xs text-white/50">
          <li className="truncate">Roméo et Juliette — analyse</li>
          <li className="truncate">Les Amants de Conakry — comparaison</li>
          <li className="truncate">Protection plagiat — chat</li>
        </ul>
      </div>

      {/* Bas de sidebar */}
      <nav className="mt-auto space-y-1 border-t border-white/10 pt-4">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-soft-pink/30 text-sm font-bold text-soft-pink">
            D
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              ADEKAMBI David
            </p>
            <p className="truncate text-xs text-white/50">Membre PRO</p>
          </div>
        </div>
      </nav>
    </aside>
  );
}
