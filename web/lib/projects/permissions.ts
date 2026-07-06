import { connectDB } from "@/lib/db/mongoose";
import { ProjectMember, type ProjectRole } from "@/lib/db/models/project-member";

export type { ProjectRole };

/** Résout le rôle de l'utilisateur sur un projet, ou `null` s'il n'en est pas membre. */
export async function getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  await connectDB();
  const member = await ProjectMember.findOne({ projectId, userId }).lean();
  return (member?.role as ProjectRole | undefined) ?? null;
}

/** Owner et co-admin : gestion des collaborateurs, réglages, archivage. Seul owner supprime. */
export function canManageProject(role: ProjectRole | null): boolean {
  return role === "owner" || role === "co-admin";
}

/** Owner, co-admin, collaborateur : peuvent lancer Analyse/Comparaison/Chat et ajouter des pièces jointes. */
export function canLaunchTools(role: ProjectRole | null): boolean {
  return role === "owner" || role === "co-admin" || role === "collaborateur";
}

/** Tout membre (y compris lecteur) peut consulter historique/rapports/pièces jointes. */
export function canView(role: ProjectRole | null): boolean {
  return role !== null;
}

/** Seul le owner peut supprimer le projet. */
export function canDeleteProject(role: ProjectRole | null): boolean {
  return role === "owner";
}

/** Génère un token de lien d'invitation (hex 32 caractères). */
export function generateInviteLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Un projet confidentiel désactive le lien d'invitation générique (dérivé, pas stocké). */
export function isInviteLinkActive(project: { confidential: boolean }): boolean {
  return !project.confidential;
}
