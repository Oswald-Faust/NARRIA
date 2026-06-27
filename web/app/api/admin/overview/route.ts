import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/guard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { ApiUsage } from "@/lib/db/models/api-usage";
import { LoginEvent } from "@/lib/db/models/login-event";

const DAY = 86400000;

/** Construit 14 jours de buckets (clé AAAA-MM-JJ) à partir d'agrégats Mongo. */
function buildSeries(
  rows: { _id: string; count: number }[],
  days = 14,
): { date: string; count: number }[] {
  const map = new Map(rows.map((r) => [r._id, r.count]));
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    out.push({ date: d, count: map.get(d) ?? 0 });
  }
  return out;
}

const groupByDay = [
  { $match: { createdAt: { $gte: new Date(Date.now() - 14 * DAY) } } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
];

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  await connectDB();
  const since7 = new Date(Date.now() - 7 * DAY);
  const since30 = new Date(Date.now() - 30 * DAY);
  const since24h = new Date(Date.now() - DAY);

  const [
    totalUsers, admins, verified, activeUsers, newUsers7, newUsers30,
    totalAnalyses, analyses7, totalComparisons, comparisons7,
    usageAgg, chatRequests, logins24h, failedLogins7,
    analysesSeries, comparisonsSeries, chatSeries,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ emailVerified: true }),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: since7 } }),
    User.countDocuments({ createdAt: { $gte: since30 } }),
    Analysis.countDocuments({}),
    Analysis.countDocuments({ createdAt: { $gte: since7 } }),
    Comparison.countDocuments({}),
    Comparison.countDocuments({ createdAt: { $gte: since7 } }),
    ApiUsage.aggregate([
      { $match: { route: "chat" } },
      {
        $group: {
          _id: null,
          tokens: { $sum: "$totalTokens" },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          cost: { $sum: "$costUsd" },
          count: { $sum: 1 },
        },
      },
    ]),
    ApiUsage.countDocuments({ route: "chat" }),
    LoginEvent.countDocuments({ success: true, createdAt: { $gte: since24h } }),
    LoginEvent.countDocuments({ success: false, createdAt: { $gte: since7 } }),
    Analysis.aggregate(groupByDay),
    Comparison.aggregate(groupByDay),
    ApiUsage.aggregate([{ $match: { route: "chat" } }, ...groupByDay]),
  ]);

  const u = usageAgg[0] ?? {};

  return NextResponse.json({
    users: {
      total: totalUsers, admins, verified, active: activeUsers,
      new7d: newUsers7, new30d: newUsers30,
    },
    analyses: { total: totalAnalyses, last7d: analyses7 },
    comparisons: { total: totalComparisons, last7d: comparisons7 },
    ai: {
      requests: chatRequests,
      tokens: u.tokens ?? 0,
      inputTokens: u.inputTokens ?? 0,
      outputTokens: u.outputTokens ?? 0,
      estimatedCostUsd: u.cost ?? 0,
    },
    logins: { last24h: logins24h, failed7d: failedLogins7 },
    series: {
      analyses: buildSeries(analysesSeries),
      comparisons: buildSeries(comparisonsSeries),
      chat: buildSeries(chatSeries),
    },
  });
}
