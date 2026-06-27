import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/guard";

/**
 * Révèle la clé API en clair — réservé aux admins, sur action explicite.
 * Volontairement en POST (pas de mise en cache / préchargement).
 */
export async function POST() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Aucune clé configurée" }, { status: 404 });

  return NextResponse.json({ key });
}
