import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { TwoFactorClient } from "@/components/profile/two-factor-client";

export default async function TwoFactorPage() {
  const session = await auth();
  await connectDB();
  const user = session?.user?.id ? await User.findById(session.user.id).lean() : null;

  return (
    <TwoFactorClient
      initialEnabled={user?.twoFactor?.enabled ?? false}
      initialMethod={user?.twoFactor?.method ?? ""}
      initialPhoneNumber={user?.twoFactor?.phoneNumber ?? ""}
      initialBackupCodes={user?.twoFactor?.backupCodes ?? []}
    />
  );
}
