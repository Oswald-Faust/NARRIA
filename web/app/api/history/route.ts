import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  await connectDB();
  const ownerId = session.user.id;

  const [analyses, comparisons] = await Promise.all([
    Analysis.find({ ownerId }).sort({ createdAt: -1 }).limit(50).lean(),
    Comparison.find({ ownerId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  return NextResponse.json({
    analyses: analyses.map((a) => ({
      id: String(a._id), title: a.title, author: a.author,
      mode: a.mode, nNodes: a.nNodes, createdAt: a.createdAt,
    })),
    comparisons: comparisons.map((c) => ({
      id: String(c._id), refTitle: c.refTitle, candTitle: c.candTitle,
      sns: c.scores?.sns, srjLevel: c.srjLevel, modality: c.modality,
      createdAt: c.createdAt,
    })),
  });
}
