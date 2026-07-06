import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { getProjectRole, canManageProject, generateInviteLinkToken } from "@/lib/projects/permissions";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = { inviteLinkToken: generateInviteLinkToken() };
  if (["co-admin", "collaborateur", "lecteur"].includes(body?.inviteLinkRole)) {
    update.inviteLinkRole = body.inviteLinkRole;
  }

  await connectDB();
  const project = await Project.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  return NextResponse.json({ inviteLinkToken: project?.inviteLinkToken });
}
