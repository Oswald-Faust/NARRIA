"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";
import type { ShellUser } from "./types";

/**
 * Shell applicatif responsive :
 * - Desktop (lg+) : sidebar inline repliable, état persisté.
 * - Mobile (<lg) : sidebar en drawer coulissant déclenché par le hamburger.
 */
export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: ShellUser;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("narria.sidebar.collapsed") === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname.startsWith("/admin") && user.role === "admin") {
    return <AdminShell user={user}>{children}</AdminShell>;
  }

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("narria.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop (inline) */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} user={user} />
      </div>

      {/* Drawer mobile + backdrop */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "" : "pointer-events-none")}>
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar collapsed={false} user={user} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenMobile={() => setMobileOpen(true)}
          user={user}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
