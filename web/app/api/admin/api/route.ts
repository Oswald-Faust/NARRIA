import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/guard";
import { connectDB } from "@/lib/db/mongoose";
import { ApiUsage } from "@/lib/db/models/api-usage";
import { User } from "@/lib/db/models/user";
import { fetchAnthropicCost, fetchAnthropicUsage, hasAdminKey } from "@/lib/anthropic-admin";

const DAY = 86400000;

function maskKey(key: string | undefined) {
  if (!key) return { configured: false, masked: "", prefix: "", last4: "", lengthValid: false };
  return {
    configured: true,
    prefix: key.slice(0, 14),
    last4: key.slice(-4),
    masked: `${key.slice(0, 14)}${"•".repeat(8)}${key.slice(-4)}`,
    lengthValid: key.length > 40,
  };
}

async function spendSince(since: Date) {
  const agg = await ApiUsage.aggregate([
    { $match: { route: "chat", createdAt: { $gte: since } } },
    { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: "$totalTokens" }, cost: { $sum: "$costUsd" } } },
  ]);
  const r = agg[0] ?? {};
  return { requests: r.requests ?? 0, tokens: r.tokens ?? 0, cost: r.cost ?? 0 };
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  await connectDB();

  const [all, d30, d7, d1, byModel, recent, anthropicCost, anthropicUsage] = await Promise.all([
    spendSince(new Date(0)),
    spendSince(new Date(Date.now() - 30 * DAY)),
    spendSince(new Date(Date.now() - 7 * DAY)),
    spendSince(new Date(Date.now() - DAY)),
    ApiUsage.aggregate([
      { $match: { route: "chat" } },
      {
        $group: {
          _id: "$model",
          requests: { $sum: 1 },
          tokens: { $sum: "$totalTokens" },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          cost: { $sum: "$costUsd" },
        },
      },
      { $sort: { cost: -1 } },
    ]),
    ApiUsage.find({ route: "chat" }).sort({ createdAt: -1 }).limit(40).lean(),
    fetchAnthropicCost(30),
    fetchAnthropicUsage(30),
  ]);

  // Résout les e-mails des auteurs des requêtes récentes.
  const ownerIds = [...new Set(recent.map((r) => r.ownerId))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("email").lean();
  const emailMap = new Map(owners.map((o) => [String(o._id), o.email]));

  return NextResponse.json({
    key: maskKey(process.env.ANTHROPIC_API_KEY),
    adminApi: { configured: hasAdminKey() },
    spend: { all, last30d: d30, last7d: d7, last24h: d1 },
    byModel: byModel.map((m) => ({
      model: m._id || "—",
      requests: m.requests,
      tokens: m.tokens,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      cost: m.cost,
    })),
    anthropic: {
      available: hasAdminKey() && anthropicCost !== null,
      costUsd: anthropicCost?.totalUsd ?? null,
      currency: anthropicCost?.currency ?? "USD",
      inputTokens: anthropicUsage?.inputTokens ?? null,
      outputTokens: anthropicUsage?.outputTokens ?? null,
      startingAt: anthropicCost?.startingAt ?? null,
    },
    recentRequests: recent.map((r) => ({
      id: String(r._id),
      email: emailMap.get(r.ownerId) ?? "—",
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      totalTokens: r.totalTokens,
      costUsd: r.costUsd,
      success: r.success,
      createdAt: r.createdAt,
    })),
  });
}
