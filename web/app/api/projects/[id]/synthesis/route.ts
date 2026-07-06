import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { getProjectRole, canView } from "@/lib/projects/permissions";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canView(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé ANTHROPIC_API_KEY manquante côté serveur." }, { status: 503 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const [analyses, comparisons] = await Promise.all([
    Analysis.find({ projectId: id }).select("title author summary genre tradition").lean(),
    Comparison.find({ projectId: id }).select("refTitle candTitle scores srjLevel modality verdict").lean(),
  ]);

  if (analyses.length === 0 && comparisons.length === 0) {
    return NextResponse.json(
      { error: "Aucun rapport dans ce projet pour le moment — lancez une analyse ou une comparaison." },
      { status: 400 },
    );
  }

  const analysesText = analyses
    .map((a) => `- Analyse « ${a.title} » (${a.author}) : genre ${a.genre || "?"}, tradition ${a.tradition || "?"}. Résumé : ${a.summary || "non disponible"}`)
    .join("\n");
  const comparisonsText = comparisons
    .map((c) => `- Comparaison « ${c.refTitle} » vs « ${c.candTitle} » : SNS ${c.scores?.sns?.toFixed(2) ?? "?"}, risque ${c.srjLevel}, modalité ${c.modality}. Verdict : ${c.verdict}`)
    .join("\n");

  const prompt = `Voici les rapports narratologiques du projet « ${project.name} » (${project.type}) :

${analysesText ? `Analyses :\n${analysesText}\n` : ""}
${comparisonsText ? `Comparaisons :\n${comparisonsText}\n` : ""}

Rédige une synthèse globale du dossier en 3-4 paragraphes : tendances communes, points de
convergence entre les différentes analyses/comparaisons, et une recommandation prudente sur
la suite à donner (rappelle que ce n'est jamais une preuve juridique). Réponds en français,
sans préambule.`;

  const result = await generateText({ model: anthropic(EXTRACTION_MODEL_ID), prompt });
  const text = result.text.trim();

  await Project.updateOne({ _id: id }, { $set: { lastSynthesis: { text, generatedAt: new Date() } } });

  return NextResponse.json({ text, generatedAt: new Date().toISOString() });
}
