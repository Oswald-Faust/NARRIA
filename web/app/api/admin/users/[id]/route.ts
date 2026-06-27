import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/guard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { ApiUsage } from "@/lib/db/models/api-usage";
import { LoginEvent } from "@/lib/db/models/login-event";
import { Notification } from "@/lib/db/models/notification";
import { ChatConversation } from "@/lib/db/models/chat-conversation";
import { createNotification } from "@/lib/notifications";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  const { id } = await params;
  await connectDB();

  const user = await User.findById(id).lean();
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const [analyses, comparisons, usageAgg, logins] = await Promise.all([
    Analysis.find({ ownerId: id }).sort({ createdAt: -1 }).limit(25).lean(),
    Comparison.find({ ownerId: id }).sort({ createdAt: -1 }).limit(25).lean(),
    ApiUsage.aggregate([
      { $match: { ownerId: id } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          tokens: { $sum: "$totalTokens" },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          cost: { $sum: "$costUsd" },
        },
      },
    ]),
    LoginEvent.find({ ownerId: id }).sort({ createdAt: -1 }).limit(25).lean(),
  ]);

  const usage = usageAgg[0] ?? {};

  return NextResponse.json({
    user: {
      id: String(user._id),
      email: user.email,
      nomComplet: user.nomComplet,
      prenom: user.prenom,
      role: user.role,
      plan: user.plan,
      profession: user.profession || "",
      country: user.country || "",
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      twoFactor: Boolean(user.twoFactor?.enabled),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      loginCount: user.loginCount ?? 0,
    },
    usage: {
      requests: usage.requests ?? 0,
      tokens: usage.tokens ?? 0,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      costUsd: usage.cost ?? 0,
    },
    analyses: analyses.map((a) => ({
      id: String(a._id), title: a.title, author: a.author, nNodes: a.nNodes, createdAt: a.createdAt,
    })),
    comparisons: comparisons.map((c) => ({
      id: String(c._id), refTitle: c.refTitle, candTitle: c.candTitle,
      sns: c.scores?.sns ?? 0, srjLevel: c.srjLevel, createdAt: c.createdAt,
    })),
    logins: logins.map((l) => ({
      id: String(l._id), ip: l.ip, userAgent: l.userAgent, success: l.success, createdAt: l.createdAt,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const title = body?.title?.trim();
  const message = body?.message?.trim();
  const href = body?.href?.trim() || "";

  if (!title) {
    return NextResponse.json({ error: "Le titre de la notification est requis" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(id).lean();
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  await createNotification({
    ownerId: id,
    type: "system",
    title,
    body: message || `Message envoyé par l'administration à ${user.email}.`,
    href,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  const { id } = await params;
  if (admin.id === id) {
    return NextResponse.json({ error: "Suppression de votre propre compte admin interdite" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(id).lean();
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  await Promise.all([
    Analysis.deleteMany({ ownerId: id }),
    Comparison.deleteMany({ ownerId: id }),
    ApiUsage.deleteMany({ ownerId: id }),
    LoginEvent.deleteMany({ ownerId: id }),
    Notification.deleteMany({ ownerId: id }),
    ChatConversation.deleteMany({ ownerId: id }),
    User.findByIdAndDelete(id),
  ]);

  return NextResponse.json({ ok: true });
}
