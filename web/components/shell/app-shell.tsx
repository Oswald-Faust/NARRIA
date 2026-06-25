"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Shell applicatif : sidebar repliable + topbar + contenu. État persisté. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("narria.sidebar.collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("narria.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar collapsed={collapsed} onToggle={toggle} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
