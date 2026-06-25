import Link from "next/link";
import { LayoutDashboard, Search, HelpCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Barre supérieure : salutation, Dashboard, recherche, aide, notifications, avatar. */
export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/60 px-6 backdrop-blur">
      <div>
        <p className="font-heading text-base font-bold text-foreground">
          Bonjour, David !
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
          <Search className="h-[18px] w-[18px]" />
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
        </button>
        <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-soft-pink/30 text-sm font-bold text-soft-pink">
          D
        </div>
      </div>
    </header>
  );
}
