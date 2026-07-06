import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { getProjectRole, canLaunchTools } from "@/lib/projects/permissions";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 Mo (cohérent avec la maquette)
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".mp3"];

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
  if (!canLaunchTools(role)) {
    return NextResponse.json({ error: "Droits insuffisants pour ajouter une pièce jointe." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
  }
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Format non supporté. Formats acceptés : ${ALLOWED_EXTENSIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  const blob = await put(`projects/${id}/${Date.now()}-${file.name}`, file, { access: "public" });

  const attachment = {
    id: crypto.randomUUID(),
    filename: file.name,
    url: blob.url,
    size: file.size,
    mimeType: file.type,
    uploadedBy: session.user.id,
    uploadedAt: new Date(),
  };

  await connectDB();
  await Project.updateOne({ _id: id }, { $push: { attachments: attachment } });

  return NextResponse.json({ attachment });
}
