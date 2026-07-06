import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { ChatConversation } from "@/lib/db/models/chat-conversation";
import { resolveProjectLaunchContext } from "@/lib/projects/permissions";

function titleFromText(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return "Nouvelle conversation";
  return normalized.length > 48 ? `${normalized.slice(0, 48).trimEnd()}…` : normalized;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  await connectDB();
  const conversations = await ChatConversation.find({ ownerId: session.user.id })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(8)
    .lean();

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: String(c._id),
      title: c.title,
      updatedAt: c.updatedAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = titleFromText(body?.title ?? "");
  const { projectId, error: projectError } = await resolveProjectLaunchContext(body?.projectId, session.user.id);
  if (projectError) {
    return NextResponse.json({ error: projectError }, { status: 403 });
  }

  await connectDB();
  const conversation = await ChatConversation.create({
    ownerId: session.user.id,
    title,
    messages: [],
    lastMessageAt: new Date(),
    projectId,
  });

  return NextResponse.json({
    conversation: {
      id: String(conversation._id),
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    },
  });
}
