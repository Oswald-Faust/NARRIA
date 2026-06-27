import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { LoginEvent } from "@/lib/db/models/login-event";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/schemas";

/** Journalise une connexion (best-effort, ne bloque jamais l'auth). */
async function logLogin(
  data: { ownerId?: string; email: string; success: boolean },
  req?: Request,
) {
  try {
    const ip =
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req?.headers.get("x-real-ip") ||
      "";
    const userAgent = req?.headers.get("user-agent") || "";
    await LoginEvent.create({ ...data, ip, userAgent });
  } catch (err) {
    console.error("[auth] journal de connexion impossible:", err);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        await connectDB();
        const user = await User.findOne({ email: parsed.data.email });
        if (!user || !user.isActive) {
          await logLogin({ email: parsed.data.email, success: false }, req);
          return null;
        }

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) {
          await logLogin({ ownerId: String(user._id), email: user.email, success: false }, req);
          return null;
        }
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // Connexion réussie : trace + compteurs.
        await logLogin({ ownerId: String(user._id), email: user.email, success: true }, req);
        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } },
        );

        return {
          id: String(user._id),
          email: user.email,
          name: user.nomComplet,
          role: user.role,
        };
      },
    }),
  ],
});
