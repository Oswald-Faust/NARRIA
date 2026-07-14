import { ProjectInvitation } from "@/lib/db/models/project-invitation";

/**
 * Résout l'invitation visée par un lien d'invitation.
 *
 * On cherche d'abord par jeton. En repli, on accepte une invitation *nominative en attente*
 * adressée à l'e-mail du compte connecté : cela couvre les liens dont le jeton n'existe plus
 * (invitation antérieure à l'introduction des jetons, jeton régénéré par un renvoi d'invitation…),
 * sans jamais élargir l'accès — il faut toujours une invitation `pending` pour cette adresse.
 */
export async function findInvitationForUser(token: string, userEmail?: string | null) {
  const byToken = await ProjectInvitation.findOne({ token });
  if (byToken) return byToken;

  const email = userEmail?.trim().toLowerCase();
  if (!email) return null;

  return ProjectInvitation.findOne({ email, status: "pending" }).sort({ createdAt: -1 });
}
