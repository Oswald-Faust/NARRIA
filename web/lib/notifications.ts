import { connectDB } from "@/lib/db/mongoose";
import { Notification, type NotificationType } from "@/lib/db/models/notification";

interface CreateNotificationInput {
  ownerId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
}

/**
 * Crée une notification. Volontairement tolérant aux erreurs : un échec
 * d'écriture ne doit jamais faire échouer l'action métier qui l'a déclenchée
 * (analyse, comparaison, export…).
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    await connectDB();
    return await Notification.create({
      ownerId: input.ownerId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      href: input.href ?? "",
    });
  } catch (err) {
    console.error("[notifications] création impossible:", err);
    return null;
  }
}
