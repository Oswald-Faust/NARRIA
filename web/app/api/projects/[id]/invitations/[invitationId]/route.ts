import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { getProjectRole, canManageProject } from "@/lib/projects/permissions";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, invitationId } = await params;
  if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(invitationId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  await connectDB();
  await ProjectInvitation.updateOne(
    { _id: invitationId, projectId: id },
    { $set: { status: "revoked" } },
  );
  return NextResponse.json({ ok: true });
}
