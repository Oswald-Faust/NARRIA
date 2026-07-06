import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { getProjectRole, canLaunchTools } from "@/lib/projects/permissions";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, attachmentId } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canLaunchTools(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  const attachment = project?.attachments?.find((a: { id: string; url: string }) => a.id === attachmentId);
  if (!attachment) {
    return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  }

  try {
    await del(attachment.url);
  } catch (e) {
    console.error("[projects] suppression du blob échouée (on retire quand même la référence):", e);
  }
  await Project.updateOne({ _id: id }, { $pull: { attachments: { id: attachmentId } } });

  return NextResponse.json({ ok: true });
}
