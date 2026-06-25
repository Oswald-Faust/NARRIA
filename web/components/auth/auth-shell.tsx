import * as React from "react";

/**
 * Layout d'authentification en deux panneaux — repris des écrans
 * Login / Sign Up / OTP de la maquette (hero dégradé à gauche, formulaire à droite).
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
      {/* Hero gauche */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#3a1d63] via-[#5a2a8f] to-[#1a0e35] lg:block">
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-pink/30 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-56 w-56 rounded-full bg-purple/40 blur-3xl" />
        <div className="relative z-10 flex h-full flex-col justify-center px-14">
          <span className="mb-6 inline-block w-fit rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white">
            {badge}
          </span>
          <h1 className="font-heading text-5xl font-bold leading-tight text-white">
            {title}
          </h1>
          <p className="mt-5 max-w-sm text-sm text-white/70">{subtitle}</p>
        </div>
      </div>

      {/* Panneau formulaire */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
