import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { otpSchema } from "@/lib/auth/schemas";
import { acceptPendingInvitationsForEmail } from "@/lib/projects/invitations";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = otpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Code invalide" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }
  if (
    !user.otp?.code ||
    user.otp.code !== parsed.data.code ||
    !user.otp.expiresAt ||
    new Date(user.otp.expiresAt) < new Date()
  ) {
    return NextResponse.json(
      { error: "Code incorrect ou expiré." },
      { status: 400 },
    );
  }

  user.emailVerified = true;
  user.otp = { code: null, expiresAt: null };
  await user.save();

  await acceptPendingInvitationsForEmail(String(user._id), user.email);

  return NextResponse.json({ ok: true });
}
