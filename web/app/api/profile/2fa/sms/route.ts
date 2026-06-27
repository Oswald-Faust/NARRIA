import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { generateBackupCodes } from "@/lib/auth/otp";
import { sms2faSchema } from "@/lib/auth/schemas";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = sms2faSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Numéro invalide" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  user.twoFactor.enabled = true;
  user.twoFactor.method = "sms";
  user.twoFactor.phoneNumber = parsed.data.phoneNumber.trim();
  if (!user.twoFactor.backupCodes?.length) {
    user.twoFactor.backupCodes = generateBackupCodes(5);
  }
  await user.save();

  return NextResponse.json({
    ok: true,
    method: "sms",
    phoneNumber: user.twoFactor.phoneNumber,
    backupCodes: user.twoFactor.backupCodes,
  });
}
