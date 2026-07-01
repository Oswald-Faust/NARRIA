import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { hashPassword } from "@/lib/auth/password";
import { generateOtp, otpExpiry } from "@/lib/auth/otp";
import { registerSchema } from "@/lib/auth/schemas";
import { sendOtpEmail } from "@/lib/email/brevo";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  await connectDB();
  const { email, password, nomComplet, prenom } = parsed.data;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet e-mail." },
      { status: 409 },
    );
  }

  const code = generateOtp();
  const createdUser = await User.create({
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    nomComplet,
    prenom,
    emailVerified: false,
    otp: { code, expiresAt: otpExpiry() },
  });

  try {
    await sendOtpEmail(email.toLowerCase(), code);
  } catch (error) {
    await User.deleteOne({ _id: createdUser._id }).catch(() => null);
    console.error("[NARR'IA][OTP] Echec envoi e-mail OTP", error);
    return NextResponse.json(
      { error: "Impossible d'envoyer le code de verification. Reessayez dans un instant." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    email: email.toLowerCase(),
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  });
}
