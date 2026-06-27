import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { generateBackupCodes, generateTotpSecret } from "@/lib/auth/otp";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  user.twoFactor.enabled = true;
  user.twoFactor.method = "app";
  user.twoFactor.secret = generateTotpSecret();
  user.twoFactor.backupCodes = generateBackupCodes(5);
  await user.save();

  return NextResponse.json({
    ok: true,
    method: "app",
    backupCodes: user.twoFactor.backupCodes,
  });
}
