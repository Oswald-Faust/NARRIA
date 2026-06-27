import { Schema, model, models } from "mongoose";

/** Évènement de connexion (réussie ou échouée) — journal admin & sécurité. */
const LoginEventSchema = new Schema(
  {
    ownerId: { type: String, default: "", index: true },
    email: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    success: { type: Boolean, default: true },
  },
  { timestamps: true },
);

LoginEventSchema.index({ createdAt: -1 });
LoginEventSchema.index({ ownerId: 1, createdAt: -1 });

export const LoginEvent = models.LoginEvent || model("LoginEvent", LoginEventSchema);
