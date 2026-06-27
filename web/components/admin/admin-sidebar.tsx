"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoFull, LogoMark } from "@/components/brand/logo";
import type { ShellUser } from "@/components/shell/types";
import { SignOutButton } from "@/components/auth/sign-out-button";

const ADMIN_NAV = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/admin/api", label: "API & Coûts", icon: KeyRound },
  { href: "/admin/activite", label: "Activité", icon: Activity },
];

function AdminNavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        "group flex items-center rounded-xl text-sm font-medium transition-colors",
        collapsed ? "h-11 w-11 justify-center" : "gap-3 px-3 py-2.5",
        active ? "bg-accent text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function AdminSidebar({
  collapsed,
  user,
  onNavigate,
}: {
  collapsed: boolean;
  user: ShellUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <aside
      className={cn(
        "bg-sidebar flex h-full shrink-0 flex-col py-5 transition-[width] duration-200",
        collapsed ? "w-20 items-center px-3" : "w-72 px-4",
      )}
    >
      <Link href="/admin" className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "px-1")}>
        {collapsed ? <LogoMark className="h-11" /> : <LogoFull className="h-[52px]" priority white />}
      </Link>

      {!collapsed && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-soft-pink/25 text-soft-pink">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Administration</p>
              <p className="truncate text-xs text-white/60">{user.email}</p>
            </div>
          </div>
          <p className="text-xs leading-5 text-white/65">
            Utilisateurs, activité, coûts API et actions de support centralisées.
          </p>
        </div>
      )}

      <nav className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        {ADMIN_NAV.map((item) => (
          <AdminNavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className={cn("mt-auto pt-4", collapsed ? "flex w-full flex-col items-center" : "")}>
        {!collapsed && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/65">
            <div className="mb-1 flex items-center gap-2 font-semibold text-white">
              <Bell className="h-4 w-4 text-soft-pink" />
              Notifications admin
            </div>
            <p>Envoyez des messages ciblés depuis la fiche d&apos;un utilisateur.</p>
          </div>
        )}

        <AdminNavLink
          href="/accueil"
          label="Retour à l'app"
          icon={ArrowLeftRight}
          active={false}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        {collapsed ? (
          <SignOutButton
            variant="ghost"
            size="icon"
            className="mt-3 text-white/70 hover:bg-white/10 hover:text-white"
            label=""
            aria-label="Se déconnecter"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </SignOutButton>
        ) : (
          <SignOutButton
            variant="outline"
            className="mt-3 w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
            label="Déconnexion admin"
          />
        )}
      </div>
    </aside>
  );
}
