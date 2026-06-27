"use client";

import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { koba } from "@/lib/fonts";

export function ProfileTopRow() {
  return (
    <div className="mb-5 flex items-center px-1">
      <Link
        href="/profil"
        className="text-foreground transition-colors hover:text-primary"
        aria-label="Retour au profil"
      >
        <ArrowLeft className="h-7 w-7" />
      </Link>
    </div>
  );
}

export function ProfileHero({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] bg-gradient-to-r from-[#24105a] to-[#4f38a0] px-6 py-6 text-white shadow-[0_12px_30px_rgba(33,13,78,0.12)] sm:px-7">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          {icon}
        </div>
        <div>
          <h1 className={cn(koba.className, "text-3xl font-semibold tracking-wide sm:text-4xl")}>
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-white/82 sm:text-base">{subtitle}</p>
        </div>
      </div>
    </section>
  );
}

export function ProfileWarning() {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[#edcfaa] bg-[#d7d4fb] px-5 py-4 text-[#4e429b]">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#f1a93d]" />
      <p className="text-sm leading-7">
        <span className="font-semibold text-[#f1a93d]">Avertissement important</span> : NARR&apos;IA est un outil d&apos;aide à l&apos;analyse narrative. Ses résultats constituent des indices, non des preuves légales.
      </p>
    </div>
  );
}
