import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { PasswordChangeClient } from "@/components/profile/password-change-client";

function passwordChangedLabel(date: Date | string | null | undefined) {
  if (!date) return "jamais";
  const diffMs = Date.now() - new Date(date).getTime();
  const months = Math.max(1, Math.round(diffMs / (30 * 24 * 3600 * 1000)));
  return `il y a ${months} mois`;
}

export default async function PasswordPage() {
  const session = await auth();
  await connectDB();
  const user = session?.user?.id ? await User.findById(session.user.id).lean() : null;

  return (
    <PasswordChangeClient
      changedLabel={passwordChangedLabel(user?.passwordChangedAt)}
    />
  );
}
