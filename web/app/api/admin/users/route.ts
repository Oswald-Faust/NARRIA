import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/guard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { ApiUsage } from "@/lib/db/models/api-usage";
import { hashPassword } from "@/lib/auth/password";
import { adminCreateUserSchema } from "@/lib/auth/schemas";
import { normalizePlan } from "@/lib/subscriptions";

const countByOwner = [{ $group: { _id: "$ownerId", count: { $sum: 1 } } }];

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  await connectDB();

  const [users, analysesByUser, comparisonsByUser, usageByUser] = await Promise.all([
    User.find({}).sort({ createdAt: -1 }).limit(500).lean(),
    Analysis.aggregate(countByOwner),
    Comparison.aggregate(countByOwner),
    ApiUsage.aggregate([
      {
        $group: {
          _id: "$ownerId",
          requests: { $sum: 1 },
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$costUsd" },
        },
      },
    ]),
  ]);

  const analysesMap = new Map(analysesByUser.map((r) => [r._id, r.count]));
  const comparisonsMap = new Map(comparisonsByUser.map((r) => [r._id, r.count]));
  const usageMap = new Map(usageByUser.map((r) => [r._id, r]));

  return NextResponse.json({
    users: users.map((u) => {
      const id = String(u._id);
      const usage = usageMap.get(id);
      return {
        id,
        email: u.email,
        nomComplet: u.nomComplet,
        role: u.role,
        plan: u.plan,
        emailVerified: u.emailVerified,
        isActive: u.isActive,
        country: u.country || "",
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
        loginCount: u.loginCount ?? 0,
        analyses: analysesMap.get(id) ?? 0,
        comparisons: comparisonsMap.get(id) ?? 0,
        aiRequests: usage?.requests ?? 0,
        tokens: usage?.tokens ?? 0,
        costUsd: usage?.cost ?? 0,
      };
    }),
  });
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = adminCreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  await connectDB();
  const email = parsed.data.email.toLowerCase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
  }

  const user = await User.create({
    email,
    passwordHash: await hashPassword(parsed.data.password),
    nomComplet: parsed.data.nomComplet,
    prenom: parsed.data.prenom,
    role: parsed.data.role,
    plan: normalizePlan("starter"),
    emailVerified: true,
    isActive: true,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      email: user.email,
      nomComplet: user.nomComplet,
      role: user.role,
    },
  });
}
