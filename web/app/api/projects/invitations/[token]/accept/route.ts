import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { findInvitationForUser } from "@/lib/projects/invitation-lookup";

/** Accepte une invitation nominative via son jeton : ajoute l'utilisateur connecté comme membre. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Jeton d'invitation manquant." }, { status: 400 });
  }

  await connectDB();
  const invitation = await findInvitationForUser(token, session.user.email);
  if (!invitation || invitation.status === "revoked") {
    return NextResponse.json({ error: "Cette invitation est invalide ou a déjà été utilisée." }, { status: 404 });
  }

  const project = await Project.findById(invitation.projectId).lean();
  if (!project) {
    return NextResponse.json({ error: "Le projet associé à cette invitation n'existe plus." }, { status: 404 });
  }

  const userId = session.user.id;
  const existingMember = await ProjectMember.findOne({ projectId: invitation.projectId, userId });
  if (!existingMember) {
    await ProjectMember.create({ projectId: invitation.projectId, userId, role: invitation.role });
  }

  invitation.status = "accepted";
  await invitation.save();

  return NextResponse.json({ projectId: String(invitation.projectId) });
}
