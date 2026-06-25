import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Middleware edge-safe : applique le callback `authorized` (pas d'accès DB).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/accueil/:path*",
    "/chat/:path*",
    "/analyser/:path*",
    "/comparer/:path*",
    "/historique/:path*",
    "/repertoire/:path*",
    "/projets/:path*",
    "/dashboard/:path*",
    "/profil/:path*",
  ],
};
