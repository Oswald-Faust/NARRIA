export interface ProfileData {
  nomComplet: string;
  email: string;
  profession: string;
  narrativeSpecialty: string;
  country: string;
  langue: string;
  recoveryEmail: string;
  planId: string;
  plan: string;
  planTagline: string;
  planFeatures: readonly string[];
  memberSince: string;
  renewalDate: string;
  passwordChangedLabel: string;
  twoFactorEnabled: boolean;
  twoFactorMethod: string;
  twoFactorPhoneNumber: string;
  backupCodes: string[];
}
