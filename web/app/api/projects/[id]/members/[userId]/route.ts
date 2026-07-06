import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { ProjectMember } from "@/lib/db/models/project-member";
import { getProjectRole, canManageProject } from "@/lib/projects/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, userId } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const newRole = body?.role;
  if (!["co-admin", "collaborateur", "lecteur"].includes(newRole)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  await connectDB();
  const target = await ProjectMember.findOne({ projectId: id, userId });
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Le rôle du propriétaire ne peut pas être modifié." }, { status: 403 });
  }
  await ProjectMember.updateOne({ projectId: id, userId }, { $set: { role: newRole } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, userId } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  await connectDB();
  const target = await ProjectMember.findOne({ projectId: id, userId });
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Le propriétaire ne peut pas être retiré du projet." }, { status: 403 });
  }
  await ProjectMember.deleteOne({ projectId: id, userId });
  return NextResponse.json({ ok: true });
}
