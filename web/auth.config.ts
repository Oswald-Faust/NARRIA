import type { NextAuthConfig } from "next-auth";

/**
 * Config Auth.js partagée et compatible Edge (sans accès DB) — utilisée par le
 * middleware. Les providers (Credentials) sont ajoutés dans `auth.ts` (runtime Node).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAppArea =
        nextUrl.pathname.startsWith("/accueil") ||
        nextUrl.pathname.startsWith("/chat") ||
        nextUrl.pathname.startsWith("/analyser") ||
        nextUrl.pathname.startsWith("/comparer") ||
        nextUrl.pathname.startsWith("/historique") ||
        nextUrl.pathname.startsWith("/repertoire") ||
        nextUrl.pathname.startsWith("/projets") ||
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/profil");
      if (isAppArea) return isLoggedIn;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
