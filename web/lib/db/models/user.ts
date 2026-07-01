import { Schema, model, models, type InferSchemaType } from "mongoose";

/** Utilisateur NARR'IA : auth, OTP de vérification, 2FA (TOTP), quotas, plan. */
const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    nomComplet: { type: String, required: true },
    prenom: { type: String, default: "" },
    langue: { type: String, default: "Français" },
    profession: { type: String, default: "" },
    narrativeSpecialty: { type: String, default: "" },
    country: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: { type: String, enum: ["free", "starter", "pro", "enterprise"], default: "starter" },

    emailVerified: { type: Boolean, default: false },
    otp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
    },

    recoveryEmail: { type: String, default: "" },
    passwordChangedAt: { type: Date, default: null },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      method: { type: String, default: "" },
      phoneNumber: { type: String, default: "" },
      secret: { type: String, default: null },
      backupCodes: { type: [String], default: [] },
    },

    quotaDaily: { type: Number, default: 20 },
    quotaMonthly: { type: Number, default: 200 },
    isActive: { type: Boolean, default: true },

    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: string };

export const User = models.User || model("User", UserSchema);
