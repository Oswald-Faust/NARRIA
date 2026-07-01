import * as React from "react";
import Image from "next/image";
import fond from "@/assets/fond-gauche.png";
import { koba } from "@/lib/fonts";

/**
 * Layout d'authentification en deux panneaux :
 * - gauche : image de fond (fond-gauche.png) + texte centré (titre KOBA)
 * - droite : formulaire
 */
export function AuthShell({
  badge,
  title,
  subtitle,
  children,
}: {
  badge: string;
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Hero gauche — fond image + texte centré */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image src={fond} alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#140a28]/40 via-transparent to-[#140a28]/60" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-14 text-center">
          <span className="mb-7 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
            {badge}
          </span>
          <h1 className={`${koba.className} text-5xl leading-[1.05] text-white`}>{title}</h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-white/75">{subtitle}</p>
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
