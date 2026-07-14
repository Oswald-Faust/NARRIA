import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project, PROJECT_TYPES } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { User } from "@/lib/db/models/user";
import { generateInviteLinkToken } from "@/lib/projects/permissions";
import { createNotification } from "@/lib/notifications";
import { sendProjectInvitationEmail } from "@/lib/email/brevo";
import { getAppBaseUrl } from "@/lib/app-url";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "tous";
  const q = url.searchParams.get("q")?.trim() ?? "";

  await connectDB();
  const memberships = await ProjectMember.find({ userId }).lean();
  const projectIds = memberships.map((m) => m.projectId);
  const roleByProjectId = new Map(memberships.map((m) => [String(m.projectId), m.role]));

  const filter: Record<string, unknown> = { _id: { $in: projectIds } };
  filter.archived = tab === "archives";
  if (q) filter.name = { $regex: q, $options: "i" };

  const projects = await Project.find(filter).sort({ updatedAt: -1 }).lean();

  const nPersonal = memberships.filter((m) => m.role === "owner").length;
  const nCollaborations = memberships.filter((m) => m.role !== "owner").length;

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: String(p._id),
      name: p.name,
      type: p.type,
      category: p.category,
      role: roleByProjectId.get(String(p._id)) ?? null,
      nDocuments: p.attachments?.length ?? 0,
      updatedAt: p.updatedAt,
    })),
    nPersonal,
    nCollaborations,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name: string = body?.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Le nom du projet est requis." }, { status: 400 });
  }
  const type = (PROJECT_TYPES as readonly string[]).includes(body?.type) ? body.type : "Autre";
  const category: string = body?.category?.trim() ?? "";
  const summary: string = body?.summary?.trim() ?? "";
  const confidential: boolean = body?.confidential !== false;
  const invitations: { email: string; role: string }[] = Array.isArray(body?.invitations) ? body.invitations : [];

  await connectDB();
  const ownerId = session.user.id;
  const project = await Project.create({
    ownerId,
    name,
    type,
    category,
    summary,
    confidential,
    inviteLinkToken: generateInviteLinkToken(),
  });

  await ProjectMember.create({ projectId: project._id, userId: ownerId, role: "owner" });

  const inviterName = session.user.name ?? "Un membre NARR'IA";
  const baseUrl = getAppBaseUrl();
  for (const inv of invitations) {
    const email = inv.email?.trim().toLowerCase();
    const role = ["co-admin", "collaborateur", "lecteur"].includes(inv.role) ? inv.role : "collaborateur";
    if (!email) continue;
    const token = generateInviteLinkToken();
    await ProjectInvitation.create({ projectId: project._id, email, role, invitedByUserId: ownerId, token });

    // Notification in-app pour un utilisateur déjà inscrit avec cette adresse.
    const invitedUser = await User.findOne({ email }).lean();
    if (invitedUser) {
      await createNotification({
        ownerId: String(invitedUser._id),
        type: "project",
        title: `Invitation à rejoindre « ${project.name} »`,
        body: `${inviterName} vous invite en tant que ${role}.`,
        href: `/projets/invitation/${token}`,
      });
    }

    // L'e-mail d'invitation part toujours immédiatement (plus d'option « Notifier »).
    try {
      await sendProjectInvitationEmail(email, project.name, inviterName, `${baseUrl}/projets/invitation/${token}`, role);
    } catch (e) {
      console.error("[projects] envoi de l'invitation par e-mail échoué:", e);
    }
  }

  return NextResponse.json({ id: String(project._id) });
}
