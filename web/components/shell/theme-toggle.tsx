"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Segment soleil / lune (clair / sombre) repris de la topbar Figma. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? theme : "dark";

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <button
        onClick={() => setTheme("light")}
        aria-label="Thème clair"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          current === "light" ? "bg-yellow/20 text-yellow" : "text-muted hover:text-foreground",
        )}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        aria-label="Thème sombre"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          current === "dark" ? "bg-purple/30 text-soft-purple" : "text-muted hover:text-foreground",
        )}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
