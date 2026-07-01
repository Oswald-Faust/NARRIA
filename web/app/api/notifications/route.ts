import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/lib/db/models/notification";

/** GET — liste des notifications de l'utilisateur + nombre de non lues. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  await connectDB();
  const ownerId = session.user.id;

  const [items, unreadCount] = await Promise.all([
    Notification.find({ ownerId }).sort({ createdAt: -1 }).limit(100).lean(),
    Notification.countDocuments({ ownerId, read: false }),
  ]);

  return NextResponse.json({
    unreadCount,
    notifications: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt,
    })),
  });
}

/**
 * POST — marque des notifications comme lues / non lues.
 * Body :
 *   { all: true }              → marque tout comme lu
 *   { id, read?: boolean }     → marque une notification (read défaut true)
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  await connectDB();
  const ownerId = session.user.id;

  if (body?.all === true) {
    await Notification.updateMany({ ownerId, read: false }, { $set: { read: true } });
  } else if (typeof body?.id === "string") {
    const read = body.read !== false;
    await Notification.updateOne({ _id: body.id, ownerId }, { $set: { read } });
  } else {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const unreadCount = await Notification.countDocuments({ ownerId, read: false });
  return NextResponse.json({ ok: true, unreadCount });
}
