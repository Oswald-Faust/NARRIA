"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

// Détection d'hydratation sans `setState` dans un effet : le rendu serveur lit
// `false`, le client `true`. Les callbacks sont hissés hors du composant pour
// que React ne se réabonne pas à chaque rendu.
const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Segment soleil / lune (clair / sombre) repris de la topbar Figma. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);

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
