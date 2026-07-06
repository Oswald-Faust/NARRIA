import { connectDB } from "@/lib/db/mongoose";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { ProjectMember } from "@/lib/db/models/project-member";

/**
 * Accepte automatiquement toutes les invitations `pending` correspondant à cet email :
 * crée le `ProjectMember` (idempotent si déjà membre) et marque l'invitation `accepted`.
 * Appelée à la connexion et juste après vérification de l'email à l'inscription.
 */
export async function acceptPendingInvitationsForEmail(userId: string, email: string): Promise<void> {
  await connectDB();
  const normalizedEmail = email.toLowerCase().trim();
  const pending = await ProjectInvitation.find({ email: normalizedEmail, status: "pending" });

  for (const invitation of pending) {
    const projectId = String(invitation.projectId);
    const existing = await ProjectMember.findOne({ projectId, userId });
    if (!existing) {
      await ProjectMember.create({ projectId, userId, role: invitation.role });
    }
    await ProjectInvitation.updateOne({ _id: invitation._id }, { $set: { status: "accepted" } });
  }
}
