import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { ProfileOverviewClient } from "@/components/profile/profile-overview-client";
import { ProfileWarning } from "@/components/profile/profile-shared";
import type { ProfileData } from "@/components/profile/types";
import { getPlanMeta, normalizePlan } from "@/lib/subscriptions";

function formatMemberSince(date: Date | string | undefined) {
  if (!date) return "janvier 2024";
  return new Date(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function formatRenewal(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function passwordChangedLabel(date: Date | string | null | undefined) {
  if (!date) return "jamais modifié";
  const diffMs = Date.now() - new Date(date).getTime();
  const months = Math.max(1, Math.round(diffMs / (30 * 24 * 3600 * 1000)));
  return `il y a ${months} mois`;
}

export default async function ProfilPage() {
  const session = await auth();
  await connectDB();
  const dbUser = session?.user?.id ? await User.findById(session.user.id).lean() : null;
  const planId = normalizePlan(dbUser?.plan);
  const planMeta = getPlanMeta(dbUser?.plan);

  const initialProfile: ProfileData = {
    nomComplet: dbUser?.nomComplet || session?.user?.name || "ADEKAMBI David",
    email: dbUser?.email || session?.user?.email || "adekambidavid@gmail.com",
    profession: dbUser?.profession || "Auteur & Scénariste",
    narrativeSpecialty:
      dbUser?.narrativeSpecialty ||
      (planId === "pro"
        ? "Roman policier, Thriller"
        : planId === "enterprise"
          ? "Direction éditoriale, IP management"
          : "Narratologie générale"),
    country: dbUser?.country || "France",
    langue: dbUser?.langue || "Français",
    recoveryEmail: dbUser?.recoveryEmail || dbUser?.email || session?.user?.email || "",
    planId,
    plan: planMeta.label,
    planTagline: planMeta.tagline,
    planFeatures: planMeta.features,
    memberSince: formatMemberSince(dbUser?.createdAt),
    renewalDate: formatRenewal(new Date(new Date().getFullYear(), 0, 15)),
    passwordChangedLabel: passwordChangedLabel(dbUser?.passwordChangedAt),
    twoFactorEnabled: dbUser?.twoFactor?.enabled ?? false,
    twoFactorMethod: dbUser?.twoFactor?.method ?? "",
    twoFactorPhoneNumber: dbUser?.twoFactor?.phoneNumber ?? "",
    backupCodes: dbUser?.twoFactor?.backupCodes ?? [],
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ProfileOverviewClient initialProfile={initialProfile} />
      <ProfileWarning />
    </div>
  );
}
