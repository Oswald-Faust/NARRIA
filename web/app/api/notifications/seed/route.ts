import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/lib/db/models/notification";

/**
 * Route de DÉVELOPPEMENT uniquement : peuple le compte courant avec un jeu
 * de notifications représentatif pour prévisualiser l'écran. Indisponible en
 * production — les vraies notifications proviennent du moteur (analyse,
 * comparaison, export…).
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indisponible en production" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  await connectDB();
  const ownerId = session.user.id;
  const now = Date.now();
  const min = 60_000;

  const samples = [
    {
      type: "analysis", read: false, href: "/historique",
      title: "Analyse terminée — « L'Éveil de Cassandre »",
      body: "L'analyse narrative profonde de votre roman est prête. Structure en 5 actes détectée, 3 archétypes de personnages identifiés.",
      createdAt: new Date(now - 5 * min),
    },
    {
      type: "ip", read: false, href: "/historique",
      title: "Similarité élevée détectée — Comparaison #47",
      body: "Indice de similarité narrative : 87,3 %. Les œuvres « Les Âmes Nomades » et « Errance Céleste » partagent une structure narrative quasi-identique.",
      createdAt: new Date(now - 23 * min),
    },
    {
      type: "ip", read: true, href: "",
      title: "Alerte propriété intellectuelle — Dépôt expirant",
      body: "Le dépôt légal de « Mémoires du Futur » expire dans 7 jours. Renouvelez votre protection pour maintenir vos droits d'auteur.",
      createdAt: new Date(now - 2 * 60 * min),
    },
    {
      type: "repertoire", read: true, href: "/repertoire",
      title: "Répertoire mis à jour — 12 nouvelles œuvres ajoutées",
      body: "La base de données narrative de référence a été enrichie avec 12 nouvelles œuvres du domaine public couvrant les genres : thriller, romance, science-fiction.",
      createdAt: new Date(now - 18 * 60 * min),
    },
    {
      type: "export", read: true, href: "/historique",
      title: "Rapport exporté avec succès",
      body: "Le rapport d'analyse de « Chroniques de l'Oubli » a été exporté en PDF. Vous pouvez le télécharger depuis votre espace projet.",
      createdAt: new Date(now - 22 * 60 * min),
    },
  ];

  await Notification.deleteMany({ ownerId });
  await Notification.insertMany(samples.map((s) => ({ ...s, ownerId })));

  return NextResponse.json({ ok: true, inserted: samples.length });
}
