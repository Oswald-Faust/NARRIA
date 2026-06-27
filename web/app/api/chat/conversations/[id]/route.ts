import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { ChatConversation } from "@/lib/db/models/chat-conversation";

function titleFromMessages(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser?.parts
    ?.filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join(" ")
    .trim() ?? "";

  const normalized = text.replace(/\s+/g, " ");
  if (!normalized) return "Nouvelle conversation";
  return normalized.length > 48 ? `${normalized.slice(0, 48).trimEnd()}…` : normalized;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const conversation = await ChatConversation.findOne({
    _id: id,
    ownerId: session.user.id,
  }).lean();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    conversation: {
      id: String(conversation._id),
      title: conversation.title,
      messages: conversation.messages ?? [],
      updatedAt: conversation.updatedAt,
    },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const messages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : [];
  const title = typeof body?.title === "string" && body.title.trim()
    ? body.title.trim()
    : titleFromMessages(messages);

  await connectDB();
  const conversation = await ChatConversation.findOneAndUpdate(
    { _id: id, ownerId: session.user.id },
    {
      $set: {
        title,
        messages,
        lastMessageAt: messages.length > 0 ? new Date() : new Date(0),
      },
    },
    { new: true },
  ).lean();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    conversation: {
      id: String(conversation._id),
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  await ChatConversation.deleteOne({ _id: id, ownerId: session.user.id });
  return NextResponse.json({ ok: true });
}
