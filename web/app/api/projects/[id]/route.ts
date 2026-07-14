import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project, PROJECT_TYPES } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { User } from "@/lib/db/models/user";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { ChatConversation } from "@/lib/db/models/chat-conversation";
import { getProjectRole, canManageProject, canDeleteProject } from "@/lib/projects/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }

  const role = await getProjectRole(id, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const members = await ProjectMember.find({ projectId: id }).lean();
  const memberUsers = await User.find({ _id: { $in: members.map((m) => m.userId).filter(Types.ObjectId.isValid) } })
    .select("email nomComplet prenom")
    .lean();
  const usersById = new Map(memberUsers.map((user) => [String(user._id), user]));
  const [nAnalyses, nComparisons, nChats] = await Promise.all([
    Analysis.countDocuments({ projectId: id }),
    Comparison.countDocuments({ projectId: id }),
    ChatConversation.countDocuments({ projectId: id }),
  ]);

  const [recentAnalyses, recentComparisons, recentChats] = await Promise.all([
    Analysis.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).select("title author ownerId createdAt").lean(),
    Comparison.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).select("refTitle candTitle ownerId createdAt").lean(),
    ChatConversation.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).select("title ownerId createdAt").lean(),
  ]);

  const sessions = [
    ...recentAnalyses.map((a) => ({ kind: "analysis" as const, id: String(a._id), title: a.title, ownerId: a.ownerId, createdAt: a.createdAt })),
    ...recentComparisons.map((c) => ({ kind: "comparison" as const, id: String(c._id), title: `${c.refTitle} vs ${c.candTitle}`, ownerId: c.ownerId, createdAt: c.createdAt })),
    ...recentChats.map((c) => ({ kind: "chat" as const, id: String(c._id), title: c.title, ownerId: c.ownerId, createdAt: c.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const invitations = canManageProject(role)
    ? await ProjectInvitation.find({ projectId: id, status: "pending" }).lean()
    : [];

  return NextResponse.json({
    id: String(project._id),
    name: project.name,
    type: project.type,
    category: project.category,
    summary: project.summary,
    confidential: project.confidential,
    archived: project.archived,
    createdAt: project.createdAt,
    attachments: project.attachments,
    lastSynthesis: project.lastSynthesis,
    inviteLinkToken: canManageProject(role) ? project.inviteLinkToken : null,
    role,
    viewerId: session.user.id,
    members: members.map((m) => {
      const user = usersById.get(m.userId);
      return {
        userId: m.userId,
        role: m.role,
        name: user?.nomComplet || user?.prenom || "",
        email: user?.email || "",
      };
    }),
    counts: { analyses: nAnalyses, comparisons: nComparisons, chats: nChats },
    sessions,
    pendingInvitations: invitations.map((i) => ({ id: String(i._id), email: i.email, role: i.role })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) update.name = body.name.trim();
  if ((PROJECT_TYPES as readonly string[]).includes(body?.type)) update.type = body.type;
  if (typeof body?.category === "string") update.category = body.category.trim();
  if (typeof body?.summary === "string") update.summary = body.summary.trim();
  if (typeof body?.confidential === "boolean") update.confidential = body.confidential;
  if (typeof body?.archived === "boolean") update.archived = body.archived;

  await connectDB();
  await Project.updateOne({ _id: id }, { $set: update });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }
  if (!canDeleteProject(role)) {
    return NextResponse.json({ error: "Seul le propriétaire peut supprimer le projet." }, { status: 403 });
  }

  await connectDB();
  await Promise.all([
    Project.deleteOne({ _id: id }),
    ProjectMember.deleteMany({ projectId: id }),
    ProjectInvitation.deleteMany({ projectId: id }),
  ]);
  return NextResponse.json({ ok: true });
}
