import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { RecoveryEmailClient } from "@/components/profile/recovery-email-client";

export default async function RecoveryEmailPage() {
  const session = await auth();
  await connectDB();
  const user = session?.user?.id ? await User.findById(session.user.id).lean() : null;
  const currentEmail = user?.recoveryEmail || user?.email || session?.user?.email || "";

  return (
    <RecoveryEmailClient
      currentEmail={currentEmail}
    />
  );
}
