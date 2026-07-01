import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractFile } from "@/lib/engine/extraction/file-extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 Mo

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${MAX_FILE_BYTES / 1024 / 1024} Mo).` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await extractFile(buffer, file.name);
    if (!result.text.trim()) {
      return NextResponse.json(
        {
          error:
            "Aucun texte n'a pu être extrait de ce fichier. " +
            (result.warnings[0] ?? "Vérifiez que le fichier n'est pas vide ou corrompu."),
        },
        { status: 422 },
      );
    }
    return NextResponse.json({
      text: result.text,
      title: result.title,
      author: result.author,
      sourceFilename: result.sourceFilename,
      sourceFormat: result.sourceFormat,
      wordCount: result.wordCount,
      warnings: result.warnings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur d'extraction inconnue.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
