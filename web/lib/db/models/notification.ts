import { Schema, model, models } from "mongoose";

/**
 * Notification utilisateur — émise par les événements du moteur
 * (analyse terminée, similarité élevée, export, etc.).
 */
export const NOTIFICATION_TYPES = [
  "analysis",   // analyse narrative terminée
  "comparison", // comparaison terminée / similarité détectée
  "ip",         // alerte propriété intellectuelle
  "repertoire", // mise à jour du répertoire de référence
  "export",     // rapport exporté
  "project",    // invitation reçue / a rejoint un projet
  "system",     // message système générique
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NotificationSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system" },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    href: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

NotificationSchema.index({ ownerId: 1, createdAt: -1 });

export const Notification =
  models.Notification || model("Notification", NotificationSchema);
