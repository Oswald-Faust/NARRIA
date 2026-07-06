import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { User } from "@/lib/db/models/user";
import { getProjectRole, canManageProject } from "@/lib/projects/permissions";
import { createNotification } from "@/lib/notifications";
import { sendProjectInvitationEmail } from "@/lib/email/brevo";

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
  const email: string = body?.email?.trim().toLowerCase() ?? "";
  const inviteRole = ["co-admin", "collaborateur", "lecteur"].includes(body?.role) ? body.role : "collaborateur";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const existing = await ProjectInvitation.findOne({ projectId: id, email, status: "pending" });
  const invitation = existing
    ? await ProjectInvitation.findOneAndUpdate(
        { _id: existing._id },
        { $set: { role: inviteRole, invitedByUserId: session.user.id } },
        { new: true },
      )
    : await ProjectInvitation.create({
        projectId: id,
        email,
        role: inviteRole,
        invitedByUserId: session.user.id,
      });

  const invitedUser = await User.findOne({ email }).lean();
  if (invitedUser) {
    await createNotification({
      ownerId: String(invitedUser._id),
      type: "project",
      title: `Invitation à rejoindre « ${project.name} »`,
      body: `${session.user.name ?? "Un membre"} vous invite en tant que ${inviteRole}.`,
      href: `/projets/${id}`,
    });
  }

  if (project.notifyOnInvite) {
    try {
      await sendProjectInvitationEmail(email, project.name, session.user.name ?? "Un membre NARR'IA");
    } catch (e) {
      console.error("[projects] envoi de l'invitation par e-mail échoué:", e);
    }
  }

  return NextResponse.json({ id: String(invitation._id), email, role: inviteRole });
}
