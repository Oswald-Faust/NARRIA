import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/guard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { ApiUsage } from "@/lib/db/models/api-usage";
import { LoginEvent } from "@/lib/db/models/login-event";

interface Event {
  type: "login" | "analysis" | "comparison" | "chat";
  ownerId: string;
  email?: string;
  label: string;
  detail: string;
  success: boolean;
  createdAt: Date;
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  await connectDB();

  const [logins, analyses, comparisons, chats] = await Promise.all([
    LoginEvent.find({}).sort({ createdAt: -1 }).limit(30).lean(),
    Analysis.find({}).sort({ createdAt: -1 }).limit(30).lean(),
    Comparison.find({}).sort({ createdAt: -1 }).limit(30).lean(),
    ApiUsage.find({ route: "chat" }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);

  const events: Event[] = [
    ...logins.map((l) => ({
      type: "login" as const, ownerId: l.ownerId || "", email: l.email,
      label: l.success ? "Connexion réussie" : "Connexion échouée",
      detail: l.ip ? `IP ${l.ip}` : "", success: l.success, createdAt: l.createdAt,
    })),
    ...analyses.map((a) => ({
      type: "analysis" as const, ownerId: a.ownerId,
      label: "Analyse", detail: a.title || "Sans titre", success: true, createdAt: a.createdAt,
    })),
    ...comparisons.map((c) => ({
      type: "comparison" as const, ownerId: c.ownerId,
      label: "Comparaison", detail: `${c.refTitle} / ${c.candTitle}`, success: true, createdAt: c.createdAt,
    })),
    ...chats.map((r) => ({
      type: "chat" as const, ownerId: r.ownerId,
      label: "Requête IA", detail: `${r.totalTokens} tokens`, success: r.success, createdAt: r.createdAt,
    })),
  ];

  // Résout les e-mails manquants (analyses/comparaisons/chat n'ont que ownerId).
  const ids = [...new Set(events.map((e) => e.ownerId).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ids } }).select("email").lean();
  const emailMap = new Map(owners.map((o) => [String(o._id), o.email]));

  events.forEach((e) => { if (!e.email) e.email = emailMap.get(e.ownerId) ?? "—"; });
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ events: events.slice(0, 60) });
}
