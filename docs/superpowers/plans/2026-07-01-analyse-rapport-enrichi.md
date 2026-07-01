# Analyse de texte enrichie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter fidèlement, sans changer la logique, le mode d'analyse LLM de l'ancienne
app NARR'IA (Python) vers le moteur TypeScript de NARR'IA 2.0 : upload multi-format
(txt/docx/pdf/odt/epub), extraction narratologique via Claude (system+user prompt,
restriction culturelle FN\*, chunking pour textes longs), et un rapport d'analyse complet
dans `/analyser` (synthèse, schéma actantiel + SVG, graphe narratif détaillé), avec export
HTML/PDF fidèle à la palette d'origine.

**Architecture:** Moteur pur (`web/lib/engine/extraction/*`, `web/lib/reports/*`) sans
dépendance Next.js, testable en isolation avec Vitest — même pattern que
`web/lib/engine/comparison/comparator.ts` déjà en place. Les routes API et composants
React ne font qu'orchestrer ce moteur. La géométrie du schéma actantiel est calculée une
seule fois (`web/lib/reports/actantial-geometry.ts`) et consommée à la fois par le
composant React (thème sombre) et par le template d'export HTML (palette d'origine
claire) — pas de duplication de la logique de positionnement.

**Tech Stack:** Next.js 16 / React 19 (existant), SDK `ai` + `@ai-sdk/anthropic`
(existant, `generateObject` + Zod), Mongoose (existant), Vitest (existant).
Nouvelles libs : `unpdf` (PDF, sans binding natif), `mammoth` (DOCX), `jszip` (EPUB/ODT,
formats zip), `cheerio` (parsing HTML des chapitres EPUB), `puppeteer-core` +
`@sparticuz/chromium` (export PDF serverless).

**Référence permanente (source de vérité pour la fidélité du port) :**
`docs/superpowers/specs/2026-07-01-analyse-rapport-enrichi-design.md` et les fichiers
Python cités dedans (`narria/io/file_extractor.py`, `narria/llm/claude_client.py`,
`narria/llm/chunker.py`, `narria/app.py::_render_analysis_html` /
`_render_actantial_svg`).

---

## File Structure

**Nouveaux fichiers moteur (purs, testables) :**
- `web/lib/engine/extraction/file-extractor.ts` — extraction texte multi-format + nettoyage
- `web/lib/engine/extraction/llm-prompts.ts` — system prompt + builder du user prompt
- `web/lib/engine/extraction/llm-schema.ts` — schéma Zod de la sortie LLM
- `web/lib/engine/extraction/chunker.ts` — découpage textes longs + fusion de graphes
- `web/lib/engine/extraction/llm-extractor.ts` — orchestration : prompts + génération + chunking + mapping vers `NarrativeGraph`
- `web/lib/reports/actantial-geometry.ts` — géométrie pure du schéma actantiel (positions, tailles)

**Nouveaux fichiers rapport / export (serveur) :**
- `web/lib/reports/analysis-html-report.ts` — template HTML autoportant (palette d'origine), port de `_render_analysis_html` + `_render_actantial_svg`
- `web/lib/reports/pdf.ts` — conversion HTML → PDF (puppeteer-core + chromium serverless)

**Nouveaux composants UI :**
- `web/components/analyse/file-dropzone.tsx`
- `web/components/analyse/actantial-diagram.tsx`
- `web/components/analyse/analysis-report.tsx`

**Nouvelles routes API :**
- `web/app/api/extract-file/route.ts`
- `web/app/api/analyze/[id]/export/route.ts`

**Fichiers modifiés :**
- `web/lib/db/models/analysis.ts` — nouveaux champs (mode LLM enrichi)
- `web/app/api/analyze/route.ts` — bascule sur `analyzeLLM` par défaut
- `web/app/(app)/analyser/page.tsx` — intègre `FileDropzone` + `AnalysisReport`
- `web/package.json` — nouvelles dépendances

**Nouveaux tests :**
- `web/tests/engine/file-extractor.test.ts`
- `web/tests/engine/chunker.test.ts`
- `web/tests/engine/llm-schema.test.ts`
- `web/tests/reports/actantial-geometry.test.ts`

---

### Task 1: Extraction de texte multi-format (txt/docx/pdf/odt/epub) + nettoyage

**Files:**
- Create: `web/lib/engine/extraction/file-extractor.ts`
- Test: `web/tests/engine/file-extractor.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Installer les dépendances d'extraction**

Run: `cd web && npm install unpdf mammoth jszip cheerio`
Expected: 4 packages ajoutés à `dependencies` dans `package.json`.

- [ ] **Step 2: Écrire le test des fonctions de nettoyage de texte (échoue)**

Ces fonctions sont pures et testables sans fichier binaire — elles portent
`_clean_text`, `_remove_recurring_lines`, `_remove_page_numbers` de
`narria/io/file_extractor.py`.

```typescript
// web/tests/engine/file-extractor.test.ts
import { describe, it, expect } from "vitest";
import { cleanText, removeRecurringLines, removePageNumbers } from "@/lib/engine/extraction/file-extractor";

describe("removePageNumbers", () => {
  it("retire les lignes qui ne contiennent qu'un numéro de page", () => {
    const text = "Premier paragraphe.\n12\nDeuxième paragraphe.\n- 13 -\nTroisième.";
    const result = removePageNumbers(text);
    expect(result).not.toContain("\n12\n");
    expect(result).not.toContain("- 13 -");
    expect(result).toContain("Premier paragraphe.");
    expect(result).toContain("Troisième.");
  });
});

describe("removeRecurringLines", () => {
  it("retire les lignes répétées ≥3 fois, courtes, ne commençant pas par une minuscule", () => {
    const text = [
      "CHAPITRE PREMIER",
      "Il était une fois un roi.",
      "NARR'IA — Rapport",
      "Le roi avait trois filles.",
      "NARR'IA — Rapport",
      "La plus jeune était la plus belle.",
      "NARR'IA — Rapport",
    ].join("\n");
    const result = removeRecurringLines(text);
    expect(result).not.toContain("NARR'IA — Rapport");
    expect(result).toContain("Il était une fois un roi.");
  });

  it("ne retire pas une ligne qui commence par une minuscule même répétée", () => {
    const text = ["et voici", "et voici", "et voici", "Une phrase normale."].join("\n");
    const result = removeRecurringLines(text);
    expect(result).toContain("et voici");
  });
});

describe("cleanText", () => {
  it("normalise les fins de ligne, retire les caractères de contrôle, réduit les espaces multiples", () => {
    const dirty = "Bonjour\r\nle    monde\x00\x01\n\n\n\nFin.";
    const result = cleanText(dirty, "pdf");
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\x00");
    expect(result).toContain("le monde");
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("applique la suppression de headers/footers uniquement pour le format pdf", () => {
    const text = ["Titre.", "REPEAT", "Contenu.", "REPEAT", "Suite.", "REPEAT"].join("\n");
    const cleanedPdf = cleanText(text, "pdf");
    expect(cleanedPdf).not.toContain("REPEAT");
    const cleanedTxt = cleanText(text, "txt");
    expect(cleanedTxt).toContain("REPEAT");
  });
});
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `cd web && npx vitest run tests/engine/file-extractor.test.ts`
Expected: FAIL — `Cannot find module '@/lib/engine/extraction/file-extractor'`

- [ ] **Step 4: Implémenter le module d'extraction complet**

Port fidèle de `narria/io/file_extractor.py`. Les 5 extracteurs de format retournent tous
la même forme `ExtractionResult`.

```typescript
// web/lib/engine/extraction/file-extractor.ts
/**
 * Extraction de texte multi-format — port fidèle de `narria/io/file_extractor.py`.
 * Supporte : .txt, .docx, .pdf, .odt, .epub.
 */
import mammoth from "mammoth";
import JSZip from "jszip";
import * as cheerio from "cheerio";
import { extractText as pdfExtractText, getDocumentProxy } from "unpdf";

export type SourceFormat = "txt" | "docx" | "pdf" | "odt" | "epub";

export interface ExtractionResult {
  text: string;
  sourceFormat: SourceFormat;
  sourceFilename: string;
  wordCount: number;
  charCount: number;
  pageCount: number | null;
  paragraphCount: number | null;
  warnings: string[];
  title: string;
  author: string;
}

export const SUPPORTED_EXTENSIONS: SourceFormat[] = ["txt", "docx", "pdf", "odt", "epub"];

export function extensionFromFilename(filename: string): SourceFormat | null {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  const ext = m ? m[1].toLowerCase() : "";
  return (SUPPORTED_EXTENSIONS as string[]).includes(ext) ? (ext as SourceFormat) : null;
}

// ─── Nettoyage du texte (port de _clean_text / _remove_recurring_lines / _remove_page_numbers) ───

export function removePageNumbers(text: string): string {
  const lines = text.split("\n");
  const filtered = lines.filter((line) => {
    const stripped = line.trim();
    if (/^\d{1,4}$/.test(stripped)) return false;
    if (/^[-\s]*\d{1,4}[-\s.]*$/.test(stripped) && stripped !== "") return false;
    return true;
  });
  return filtered.join("\n");
}

export function removeRecurringLines(text: string): string {
  const lines = text.split("\n");
  const counts = new Map<string, number>();
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const recurring = new Set<string>();
  for (const [line, count] of counts) {
    if (count >= 3 && line.length > 0 && line.length < 80 && !/^[a-zà-ÿ]/.test(line)) {
      recurring.add(line);
    }
  }
  if (recurring.size === 0) return text;
  return lines.filter((line) => !recurring.has(line.trim())).join("\n");
}

export function cleanText(text: string, sourceFormat: SourceFormat): string {
  if (!text) return text;
  let out = text.replace(/\r\n?/g, "\n");
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");
  if (sourceFormat === "pdf") {
    out = removeRecurringLines(out);
    out = removePageNumbers(out);
  }
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

function finalize(
  text: string,
  sourceFormat: SourceFormat,
  sourceFilename: string,
  extra: Partial<ExtractionResult> = {},
): ExtractionResult {
  const cleaned = cleanText(text, sourceFormat);
  return {
    text: cleaned,
    sourceFormat,
    sourceFilename,
    wordCount: cleaned.trim() ? cleaned.trim().split(/\s+/).length : 0,
    charCount: cleaned.length,
    pageCount: null,
    paragraphCount: null,
    warnings: [],
    title: "",
    author: "",
    ...extra,
  };
}

// ─── .txt ───

function extractTxt(buffer: Buffer, filename: string): ExtractionResult {
  let text: string;
  try {
    text = buffer.toString("utf-8");
    // Détecte un échec de décodage UTF-8 silencieux : présence du caractère de remplacement.
    if (text.includes("�")) throw new Error("invalid utf-8");
  } catch {
    text = buffer.toString("latin1");
  }
  return finalize(text, "txt", filename);
}

// ─── .docx ───

async function extractDocx(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const { value: text } = await mammoth.extractRawText({ buffer });
  const paragraphCount = text.split(/\n+/).filter((p) => p.trim()).length;
  return finalize(text, "docx", filename, { paragraphCount });
}

// ─── .pdf ───

async function extractPdf(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await pdfExtractText(pdf, { mergePages: true });

  if (totalPages >= 3 && text.trim().length < totalPages * 50) {
    warnings.push(
      "Ce PDF semble être un scan (très peu de texte détecté pour " +
        `${totalPages} pages). Pour les PDF scannés, une OCR est nécessaire, ` +
        "ce que NARR'IA ne propose pas actuellement. Si votre document est un " +
        "vrai PDF avec du texte, vérifiez qu'il n'est pas excessivement protégé.",
    );
  }

  return finalize(text, "pdf", filename, { pageCount: totalPages, warnings });
}

// ─── .odt ───

function odtXmlToText(xml: string): string {
  let s = xml;
  s = s.replace(/<text:tab\/>/g, "\t");
  s = s.replace(/<text:line-break\/>/g, "\n");
  s = s.replace(/<\/text:p>/g, "\n\n");
  s = s.replace(/<\/text:h[^>]*>/g, "\n\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return s.trim();
}

async function extractOdt(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file("content.xml");
  if (!contentFile) throw new Error("Fichier .odt invalide : content.xml introuvable.");
  const xml = await contentFile.async("string");
  const text = odtXmlToText(xml);
  const paragraphCount = (xml.match(/<text:p[ >]/g) ?? []).length;
  return finalize(text, "odt", filename, { paragraphCount });
}

// ─── .epub ───

async function extractEpub(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(buffer);

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Fichier .epub invalide : container.xml introuvable.");
  const containerXml = await containerFile.async("string");
  const rootfileMatch = /full-path="([^"]+)"/.exec(containerXml);
  if (!rootfileMatch) throw new Error("Fichier .epub invalide : rootfile introuvable.");
  const opfPath = rootfileMatch[1];
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error(`Fichier .epub invalide : ${opfPath} introuvable.`);
  const opfXml = await opfFile.async("string");

  // Métadonnées
  const titleMatch = /<dc:title[^>]*>([^<]*)<\/dc:title>/.exec(opfXml);
  const authorMatch = /<dc:creator[^>]*>([^<]*)<\/dc:creator>/.exec(opfXml);

  // Manifest : id → href
  const manifest = new Map<string, string>();
  const itemRe = /<item\b[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(opfXml))) {
    manifest.set(m[1], m[2]);
  }
  // Certains fichiers OPF ordonnent href avant id : second passage tolérant.
  const itemReAlt = /<item\b[^>]*\bhref="([^"]+)"[^>]*\bid="([^"]+)"[^>]*\/?>/g;
  while ((m = itemReAlt.exec(opfXml))) {
    if (!manifest.has(m[2])) manifest.set(m[2], m[1]);
  }

  // Spine : ordre de lecture
  const spineIds: string[] = [];
  const spineRe = /<itemref\b[^>]*\bidref="([^"]+)"/g;
  while ((m = spineRe.exec(opfXml))) spineIds.push(m[1]);

  const chapterTexts: string[] = [];
  for (const [i, id] of spineIds.entries()) {
    const href = manifest.get(id);
    if (!href) continue;
    const path = opfDir + href;
    const chapterFile = zip.file(path);
    if (!chapterFile) continue;
    try {
      const html = await chapterFile.async("string");
      const $ = cheerio.load(html, { xmlMode: false });
      $("script, style, nav, header, footer").remove();
      $("br").replaceWith("\n");
      const blockTags = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre"];
      const parts: string[] = [];
      $(blockTags.join(",")).each((_, el) => {
        const t = $(el).text().trim();
        if (t) parts.push(t);
      });
      const chapterText = parts.length > 0 ? parts.join("\n\n") : $.root().text().trim();
      if (chapterText.trim()) chapterTexts.push(chapterText);
    } catch (e) {
      warnings.push(`Chapitre ${i + 1} : erreur d'extraction (${String(e).slice(0, 80)})`);
    }
  }

  const text = chapterTexts.join("\n\n");
  if (!text.trim()) {
    warnings.push(
      "Aucun texte n'a pu être extrait de ce fichier EPUB. Il est possible que le " +
        "livre soit protégé par DRM ou que sa structure soit non standard.",
    );
  }

  return finalize(text, "epub", filename, {
    paragraphCount: chapterTexts.length,
    title: titleMatch?.[1]?.trim() ?? "",
    author: authorMatch?.[1]?.trim() ?? "",
    warnings,
  });
}

// ─── Dispatcher ───

export async function extractFile(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const format = extensionFromFilename(filename);
  if (!format) {
    throw new Error(
      `Format non supporté. Formats acceptés : ${SUPPORTED_EXTENSIONS.join(", ")}.`,
    );
  }
  switch (format) {
    case "txt":
      return extractTxt(buffer, filename);
    case "docx":
      return extractDocx(buffer, filename);
    case "pdf":
      return extractPdf(buffer, filename);
    case "odt":
      return extractOdt(buffer, filename);
    case "epub":
      return extractEpub(buffer, filename);
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `cd web && npx vitest run tests/engine/file-extractor.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Vérification manuelle sur fichiers réels (docx/pdf/odt/epub)**

Les formats binaires (docx/pdf/odt/epub) ne sont pas couverts par des fixtures
automatisées (fabriquer des binaires valides serait fragile) — vérification manuelle une
fois la route `/api/extract-file` branchée au Task 2, avec de vrais fichiers de test :
créer rapidement `web/tests/fixtures/sample.txt` (texte libre ≥200 caractères) pour le
test automatisé ci-dessus si besoin d'un fichier réel plutôt que du texte inline, et noter
dans la PR de vérifier `/analyser` avec un `.epub` réel (ex. un livre du domaine public)
et un `.pdf` texte (pas scanné) avant de considérer le Task 2 terminé.

- [ ] **Step 7: Commit**

```bash
cd web && git add lib/engine/extraction/file-extractor.ts tests/engine/file-extractor.test.ts package.json package-lock.json
git commit -m "feat(engine): extraction texte multi-format (txt/docx/pdf/odt/epub)"
```

---

### Task 2: Route d'upload + FileDropzone dans /analyser

**Files:**
- Create: `web/app/api/extract-file/route.ts`
- Create: `web/components/analyse/file-dropzone.tsx`
- Modify: `web/app/(app)/analyser/page.tsx`

- [ ] **Step 1: Créer la route API d'extraction**

```typescript
// web/app/api/extract-file/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractFile, SUPPORTED_EXTENSIONS } from "@/lib/engine/extraction/file-extractor";

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
      sourceFormat: result.sourceFormat,
      wordCount: result.wordCount,
      warnings: result.warnings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur d'extraction inconnue.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

export function supportedExtensions() {
  return SUPPORTED_EXTENSIONS;
}
```

- [ ] **Step 2: Créer le composant FileDropzone**

```tsx
// web/components/analyse/file-dropzone.tsx
"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropzoneResult {
  text: string;
  title: string;
  author: string;
  sourceFormat: string;
  wordCount: number;
  warnings: string[];
}

interface FileDropzoneProps {
  onExtracted: (result: FileDropzoneResult) => void;
  className?: string;
}

const ACCEPT = ".txt,.docx,.pdf,.odt,.epub";

export function FileDropzone({ onExtracted, className }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract-file", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'extraction du fichier.");
        return;
      }
      onExtracted(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-2 px-4 py-6 text-center transition-colors",
        dragOver && "border-soft-pink bg-surface",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-soft-purple" />
      ) : (
        <UploadCloud className="h-6 w-6 text-muted" />
      )}
      <p className="text-sm text-foreground">
        Glissez-déposez un fichier ou{" "}
        <button
          type="button"
          className="font-semibold text-soft-pink underline"
          onClick={() => inputRef.current?.click()}
        >
          parcourez vos fichiers
        </button>
      </p>
      <p className="text-xs text-muted">TXT, DOCX, PDF, ODT, EPUB — 25 Mo max</p>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Intégrer FileDropzone dans la page /analyser**

```typescript
// web/app/(app)/analyser/page.tsx
// Ajouter l'import en haut du fichier, avec les autres imports :
import { FileDropzone, type FileDropzoneResult } from "@/components/analyse/file-dropzone";
```

Ajouter, juste avant le bloc `{samples.length > 0 && (...)}` (après le `<Textarea>`) :

```tsx
        <FileDropzone
          onExtracted={(r: FileDropzoneResult) => {
            setText(r.text);
            if (r.title) setTitle(r.title);
            if (r.author) setAuthor(r.author);
            if (r.warnings.length > 0) setError(r.warnings.join(" "));
          }}
        />
```

- [ ] **Step 4: Vérification manuelle**

Run: `cd web && npm run dev`
Ouvrir `/analyser`, uploader un `.txt` puis un `.epub` réel (ex. un livre du domaine
public) : le champ texte doit se pré-remplir, titre/auteur si présents dans les
métadonnées du fichier, et les warnings s'afficher si le fichier est un scan ou vide.

- [ ] **Step 5: Commit**

```bash
cd web && git add app/api/extract-file/route.ts components/analyse/file-dropzone.tsx "app/(app)/analyser/page.tsx"
git commit -m "feat(analyse): upload de fichiers multi-format sur /analyser"
```

---

### Task 3: Prompts LLM (system + user) et schéma Zod de la sortie

**Files:**
- Create: `web/lib/engine/extraction/llm-prompts.ts`
- Create: `web/lib/engine/extraction/llm-schema.ts`
- Test: `web/tests/engine/llm-schema.test.ts`

- [ ] **Step 1: Écrire le module de prompts (port texte-à-texte)**

Port exact de `SYSTEM_PROMPT_NARRATOLOGY` et `_build_analysis_prompt` de
`narria/llm/claude_client.py` (lignes 194-312 et 456-517).

```typescript
// web/lib/engine/extraction/llm-prompts.ts
/**
 * Prompts narratologiques — port texte-à-texte de `narria/llm/claude_client.py`
 * (SYSTEM_PROMPT_NARRATOLOGY et _build_analysis_prompt). Ne pas reformuler :
 * la granularité, la restriction culturelle FN* et le format JSON dépendent
 * de la formulation exacte.
 */

export const SYSTEM_PROMPT_NARRATOLOGY = `Tu es un expert en narratologie structurale et computationnelle. Tu analyses des textes narratifs selon le cadre théorique du système NARR'IA développé par Adéchinan David Adékambi (Université de Kindia, République de Guinée).

# Cadre théorique

Le système NARR'IA combine trois traditions narratologiques :
1. La morphologie proppienne (fonctions des personnages)
2. Le schéma actantiel greimassien (Sujet, Objet, Destinateur, Destinataire, Adjuvant, Opposant)
3. La théorie des possibles narratifs de Claude Bremond (bifurcations, séquences)

Il y ajoute des apports originaux :
- Sept fonctions narratives spécifiques aux traditions africaines
- Le concept de « vol d'intrigue » (reprise non déclarée de structure narrative profonde)
- Une modélisation tensive de la courbe dramatique

# Répertoire des 53 fonctions narratives NARR'IA

## Famille 1 — Rupture initiale
- F01 Départ / F02 Désir / Quête / F03 Manque / F04 Interdiction / F05 Transgression
- F06 Exil initial / F07 Mandat

## Famille 2 — Quête et cheminement
- F10 Rencontre / F11 Don / Réception / F12 Entrée dans l'épreuve
- F13 Cheminement / F14 Reconnaissance du mentor
- F15 Épreuve qualifiante / F16 Obtention du moyen

## Famille 3 — Obstacles et conflits
- F20 Combat / F21 Trahison / F22 Menace / F23 Meurtre
- F24 Blessure / F25 Enlèvement / F26 Duel
- F27 Poursuite / F28 Épreuve principale

## Famille 4 — Pivot et reconnaissance
- F30 Reconnaissance / F31 Révélation / F32 Dissimulation
- F33 Métamorphose / F34 Renversement / F35 Anagnorisis

## Famille 5 — Résolution
- F40 Libération / F41 Triomphe / F42 Échec / F43 Mort
- F44 Pardon / F45 Vengeance / F46 Rédemption
- F47 Punition / F48 Récompense / F49 Sentence morale (moralité finale, leçon explicite)

## Famille 6 — Liaisons et relations
- F50 Amour / F51 Union / F52 Rejet / F53 Séparation
- F54 Retour / F55 Héritage / F56 Filiation

## Famille 7 — Fonctions africaines (apport NARR'IA)
- FNAL Alliance matrimoniale / clanique
- FNANC Ancêtre-arbitre (rêve, vision, oracle qui tranche un conflit)
- FNBENI Bénédiction (transmission rituelle de force par un aîné)
- FNCOMM Interpellation communautaire (voix narrative s'adressant à la communauté)
- FNGR Griot-narrateur (figure qui commente l'action)
- FNMALA Malédiction (symétrique inverse de FNBENI)
- FNPROV Proverbe narratif (sentence qui commente ou préfigure)

# Ton rôle

Tu dois analyser le récit fourni par l'utilisateur et produire un graphe narratif structuré (NarRep-Graph) au format JSON strict, sans préambule ni commentaire autour. Tu identifies les fonctions cardinales, les configurations actantielles, les transformations modales et la signature tensive. Tu justifies chaque identification par un extrait textuel.

Règles de rigueur :
- N'invente jamais d'extrait textuel — cite toujours le texte réel
- Si une fonction peut être interprétée de plusieurs manières, privilégie la plus conservatrice
- Pour les récits africains francophones, sois attentif aux fonctions FN* qui capturent des dimensions invisibles aux grilles occidentales
- Si le texte ne contient pas de trame narrative claire (description, essai, dialogue non narratif), indique-le dans summary et retourne peu ou pas de nœuds
- Reste fidèle à la succession chronologique du sjuzet (ordre de présentation dans le texte), pas à la fabula reconstituée`;

export interface PromptMeta {
  title?: string;
  author?: string;
}

export function buildUserPrompt(text: string, meta: PromptMeta = {}): string {
  let metaBlock = "";
  if (meta.title) metaBlock += `Titre : ${meta.title}\n`;
  if (meta.author) metaBlock += `Auteur : ${meta.author}\n`;
  if (metaBlock) metaBlock += "\n";

  return `${metaBlock}Voici le texte à analyser :

<texte>
${text}
</texte>

Analyse ce récit en produisant un graphe narratif structuré au format JSON.

Pour chaque fonction narrative identifiée, tu dois fournir :
1. Le code de la fonction parmi les 52 du répertoire NARR'IA (voir ta liste de référence dans le system prompt)
2. Les actants principaux impliqués (noms des personnages avec leur rôle)
3. Les valeurs modales greimassiennes (vouloir, devoir, pouvoir, savoir entre 0.0 et 1.0)
4. La tension dramatique estimée (entre 0.0 et 1.0, selon la courbe de Freytag)
5. La phase dramatique (Exposition / Complication / Climax / Résolution)
6. **Une justification textuelle citant un court extrait du texte qui appuie ton identification**
7. Un index de séquence (ordre narratif : 1, 2, 3, ...)

**Sur les deux schémas actantiels** : tu fournis SYSTÉMATIQUEMENT les deux configurations v1 et v2, même si l'une te paraît plus naturelle que l'autre. C'est le système NARR'IA qui choisira la combinaison la plus cohérente lors d'une comparaison entre deux œuvres. Si l'œuvre n'a vraiment qu'un seul actant central possible (par exemple un monologue introspectif), tu peux dupliquer la même configuration dans v1 et v2.

Règles importantes :
- **Granularité d'extraction (consigne précise)**. Le nombre de nœuds que tu identifies doit être indexé sur la LONGUEUR du texte, et non sur une « complexité » que tu apprécierais librement. La règle est :
  • Calcule d'abord, en interne, le nombre approximatif de mots du texte fourni.
  • Vise UN nœud par tranche d'environ 400 mots.
  • Applique un plancher de 5 nœuds (en deçà, le récit perd sa structure analysable) et un plafond de 35 nœuds (au-delà, le graphe devient inexploitable pour la comparaison).
  • Une tolérance de plus ou moins 15 % autour de la cible est admise pour les récits réellement denses ou réellement étalés — pas davantage.
  Cette règle prévaut sur ton appréciation subjective : deux récits de longueurs voisines doivent produire des graphes de tailles voisines, indépendamment de l'impression de richesse narrative que t'en donne la lecture.
- **Découpage régulier et reproductible**. Tu privilégies un découpage en événements cardinaux RÉGULIÈREMENT espacés dans le texte, plutôt qu'un découpage concentré sur les passages qui te paraissent saillants. Une seconde analyse du même texte doit pouvoir produire un découpage équivalent au tien : évite donc tout choix idiosyncratique de granularité, et préfère, à scènes ou chapitres équivalents, un nombre équivalent de nœuds.
- Utilise les codes exacts du répertoire NARR'IA (F01-F56 et FN...)

# RESTRICTION CULTURELLE STRICTE pour les fonctions africaines (FN*)

Les sept fonctions FNAL, FNANC, FNBENI, FNCOMM, FNGR, FNMALA, FNPROV sont
des catégories culturellement situées. Elles désignent des dispositifs
narratifs propres aux traditions africaines, afro-caribéennes et
afrodescendantes.

Avant d'attribuer une fonction FN* à un nœud, tu DOIS d'abord déterminer
la tradition narrative de l'œuvre. Si l'œuvre relève d'une tradition non
afrodescendante (européenne, asiatique, américaine non afro, etc.), tu
n'attribues JAMAIS de fonction FN*, même si un élément textuel ressemble
formellement à un dispositif africain.

Cas typique de faux positif à éviter : la moralité finale d'une fable de
La Fontaine n'est PAS un FNPROV (Proverbe narratif africain) mais une
F49 (Sentence morale, fonction occidentale). Une bénédiction parentale
dans un roman bourgeois européen n'est PAS un FNBENI mais une F44
(Pardon) ou une F11 (Don/Réception) selon le contexte.

En cas de doute sur la tradition narrative, demande-toi : « cette œuvre
s'inscrit-elle explicitement dans un héritage narratif africain
identifiable (auteur africain ou afrodescendant, œuvre référençant des
cosmogonies, des langues, des dispositifs culturels africains) ? »
Si la réponse n'est pas un oui clair, écarte les fonctions FN*.

Tu indiques explicitement dans le champ "tradition" si l'œuvre est
considérée comme afrodescendante (valeur exacte commençant par
"Africaine" ou "Afro-") ou non.

# Autres règles importantes

- La justification doit citer un segment du texte original, pas inventer
- Si le texte est trop court pour identifier certaines fonctions, n'invente pas — indique un nombre moindre de nœuds
- Réponds UNIQUEMENT avec le JSON, sans préambule ni explication autour`;
}
```

- [ ] **Step 2: Écrire le test du schéma Zod (échoue)**

```typescript
// web/tests/engine/llm-schema.test.ts
import { describe, it, expect } from "vitest";
import { LlmAnalysisSchema, enforceCulturalRestriction } from "@/lib/engine/extraction/llm-schema";

const VALID_PAYLOAD = {
  summary: "Un corbeau se fait duper par un renard flatteur.",
  genre: "Fable apologue",
  tradition: "Classique gréco-latine (fable ésopique)",
  formal_features: {
    form: "prose",
    register: "narratif_neutre",
    narrative_length_category: "tres_court",
    approximate_word_count: 120,
    has_explicit_morality: true,
    has_narrator_intervention: false,
    uses_dialogue: false,
    stylistic_signature: "Sobre et ironique.",
  },
  nodes: [
    {
      sequence: 1,
      function_code: "F49",
      function_name: "Sentence morale",
      function_family: "Résolution",
      actants: ["Renard (sujet)", "Corbeau (objet)"],
      modalities: { vouloir: 0.8, devoir: 0.1, pouvoir: 0.6, savoir: 0.7 },
      tension: 0.5,
      phase: "Résolution",
      text_excerpt: "Apprenez que tout flatteur vit aux dépens de celui qui l'écoute.",
      justification: "Moralité finale explicite.",
    },
  ],
  main_actants_v1: {
    _focus: "agent_actif",
    _description: "Le sujet est l'agent qui conduit l'action.",
    protagoniste: "Renard",
    objet: "Fromage",
    destinateur: "Faim",
    destinataire: "Renard lui-même",
    adjuvant: "Ruse",
    opposant: "Méfiance du corbeau",
  },
  main_actants_v2: {
    _focus: "patient_central",
    _description: "Le sujet subit l'action.",
    protagoniste: "Corbeau",
    objet: "Garder le fromage",
    destinateur: "Vanité",
    destinataire: "Corbeau lui-même",
    adjuvant: "Position en hauteur",
    opposant: "Flatterie du renard",
  },
  thematic_keywords: ["vanité", "flatterie", "ruse"],
};

describe("LlmAnalysisSchema", () => {
  it("accepte un payload conforme", () => {
    const parsed = LlmAnalysisSchema.parse(VALID_PAYLOAD);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].function_code).toBe("F49");
  });

  it("rejette un payload sans nodes", () => {
    const { nodes: _nodes, ...invalid } = VALID_PAYLOAD;
    expect(() => LlmAnalysisSchema.parse(invalid)).toThrow();
  });

  it("rejette une modalité hors [0,1]", () => {
    const invalid = {
      ...VALID_PAYLOAD,
      nodes: [{ ...VALID_PAYLOAD.nodes[0], modalities: { vouloir: 1.5, devoir: 0.1, pouvoir: 0.6, savoir: 0.7 } }],
    };
    expect(() => LlmAnalysisSchema.parse(invalid)).toThrow();
  });
});

describe("enforceCulturalRestriction", () => {
  it("laisse passer les fonctions FN* pour une tradition africaine", () => {
    const data = { ...VALID_PAYLOAD, tradition: "Africaine orale (contes peuls)", nodes: [{ ...VALID_PAYLOAD.nodes[0], function_code: "FNPROV", function_name: "Proverbe narratif" }] };
    const parsed = LlmAnalysisSchema.parse(data);
    const result = enforceCulturalRestriction(parsed);
    expect(result.nodes[0].function_code).toBe("FNPROV");
  });

  it("recode une fonction FN* vers son équivalent occidental pour une tradition non africaine", () => {
    const data = { ...VALID_PAYLOAD, tradition: "Classique gréco-latine (fable ésopique)", nodes: [{ ...VALID_PAYLOAD.nodes[0], function_code: "FNPROV", function_name: "Proverbe narratif" }] };
    const parsed = LlmAnalysisSchema.parse(data);
    const result = enforceCulturalRestriction(parsed);
    expect(result.nodes[0].function_code).toBe("F49");
    expect(result.nodes[0].function_name).toBe("Sentence morale");
  });
});
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `cd web && npx vitest run tests/engine/llm-schema.test.ts`
Expected: FAIL — module `@/lib/engine/extraction/llm-schema` introuvable

- [ ] **Step 4: Implémenter le schéma Zod + la restriction culturelle**

Port de la structure JSON attendue (lignes 211-265 de `claude_client.py`) et de
`_enforce_cultural_restriction` / `AFRICAN_TO_WESTERN_FALLBACK` (lignes 356-426).

```typescript
// web/lib/engine/extraction/llm-schema.ts
import { z } from "zod";

const ModalitiesSchema = z.object({
  vouloir: z.number().min(0).max(1),
  devoir: z.number().min(0).max(1),
  pouvoir: z.number().min(0).max(1),
  savoir: z.number().min(0).max(1),
});

const LlmNodeSchema = z.object({
  sequence: z.number().int().positive(),
  function_code: z.string(),
  function_name: z.string(),
  function_family: z.string(),
  actants: z.array(z.string()),
  modalities: ModalitiesSchema,
  tension: z.number().min(0).max(1),
  phase: z.string(),
  text_excerpt: z.string(),
  justification: z.string(),
});

const ActantConfigSchema = z.object({
  _focus: z.string(),
  _description: z.string(),
  protagoniste: z.string(),
  objet: z.string(),
  destinateur: z.string(),
  destinataire: z.string(),
  adjuvant: z.string(),
  opposant: z.string(),
});

const FormalFeaturesSchema = z.object({
  form: z.string(),
  register: z.string(),
  narrative_length_category: z.string(),
  approximate_word_count: z.number().int().nonnegative(),
  has_explicit_morality: z.boolean(),
  has_narrator_intervention: z.boolean(),
  uses_dialogue: z.boolean(),
  stylistic_signature: z.string(),
});

export const LlmAnalysisSchema = z.object({
  summary: z.string(),
  genre: z.string(),
  tradition: z.string(),
  formal_features: FormalFeaturesSchema,
  nodes: z.array(LlmNodeSchema),
  main_actants_v1: ActantConfigSchema,
  main_actants_v2: ActantConfigSchema,
  thematic_keywords: z.array(z.string()),
});

export type LlmAnalysis = z.infer<typeof LlmAnalysisSchema>;
export type LlmNode = z.infer<typeof LlmNodeSchema>;

/** Mapping des fonctions africaines vers leur équivalent occidental (port de AFRICAN_TO_WESTERN_FALLBACK). */
const AFRICAN_TO_WESTERN_FALLBACK: Record<string, [string, string]> = {
  FNPROV: ["F49", "Sentence morale"],
  FNBENI: ["F11", "Don / Réception"],
  FNMALA: ["F47", "Punition"],
  FNANC: ["F31", "Révélation"],
  FNGR: ["F32", "Dissimulation"],
  FNAL: ["F51", "Union"],
  FNCOMM: ["F49", "Sentence morale"],
};

function isAfrodescendantTradition(tradition: string): boolean {
  const t = tradition.trim().toLowerCase();
  return (
    t.startsWith("africain") ||
    t.startsWith("afro") ||
    t.includes("afrique") ||
    t.includes("caribéen") ||
    t.includes("afrodescendant")
  );
}

/**
 * Filet de sécurité : retire les fonctions FN* attribuées à tort à une œuvre non
 * afrodescendante, et les remplace par leur équivalent occidental le plus proche.
 * Port de `_enforce_cultural_restriction`.
 */
export function enforceCulturalRestriction(data: LlmAnalysis): LlmAnalysis {
  if (isAfrodescendantTradition(data.tradition)) return data;

  const nodes = data.nodes.map((node) => {
    if (!node.function_code.startsWith("FN")) return node;
    const fallback = AFRICAN_TO_WESTERN_FALLBACK[node.function_code] ?? ["F49", "Sentence morale"];
    return { ...node, function_code: fallback[0], function_name: fallback[1] };
  });

  return { ...data, nodes };
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `cd web && npx vitest run tests/engine/llm-schema.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
cd web && git add lib/engine/extraction/llm-prompts.ts lib/engine/extraction/llm-schema.ts tests/engine/llm-schema.test.ts
git commit -m "feat(engine): prompts narratologiques + schéma Zod + restriction culturelle FN*"
```

---

### Task 4: Chunking des textes longs + fusion de graphes partiels

**Files:**
- Create: `web/lib/engine/extraction/chunker.ts`
- Test: `web/tests/engine/chunker.test.ts`

- [ ] **Step 1: Écrire le test du chunking et de la fusion (échoue)**

```typescript
// web/tests/engine/chunker.test.ts
import { describe, it, expect } from "vitest";
import { estimateTokens, needsChunking, chunkText, mergePartialGraphs, CHUNK_THRESHOLD_TOKENS } from "@/lib/engine/extraction/chunker";
import type { LlmAnalysis } from "@/lib/engine/extraction/llm-schema";

function makeAnalysis(overrides: Partial<LlmAnalysis> & { nodes: LlmAnalysis["nodes"] }): LlmAnalysis {
  return {
    summary: overrides.summary ?? "Résumé.",
    genre: overrides.genre ?? "Genre",
    tradition: overrides.tradition ?? "Classique occidentale",
    formal_features: overrides.formal_features ?? {
      form: "prose", register: "narratif_neutre", narrative_length_category: "court",
      approximate_word_count: 100, has_explicit_morality: false,
      has_narrator_intervention: false, uses_dialogue: false, stylistic_signature: "Sobre.",
    },
    main_actants_v1: overrides.main_actants_v1 ?? { _focus: "agent_actif", _description: "d", protagoniste: "A", objet: "O", destinateur: "D", destinataire: "R", adjuvant: "Adj", opposant: "Opp" },
    main_actants_v2: overrides.main_actants_v2 ?? { _focus: "patient_central", _description: "d", protagoniste: "A", objet: "O", destinateur: "D", destinataire: "R", adjuvant: "Adj", opposant: "Opp" },
    thematic_keywords: overrides.thematic_keywords ?? ["thème"],
    nodes: overrides.nodes,
  };
}

describe("estimateTokens / needsChunking", () => {
  it("estime ~1.2 token par 4 caractères", () => {
    const text = "a".repeat(4000);
    expect(estimateTokens(text)).toBe(Math.floor((4000 / 4) * 1.2));
  });

  it("ne nécessite pas de chunking sous le seuil", () => {
    expect(needsChunking("texte court")).toBe(false);
  });

  it("nécessite un chunking au-delà du seuil", () => {
    const bigText = "mot ".repeat(CHUNK_THRESHOLD_TOKENS); // largement au-dessus en tokens estimés
    expect(needsChunking(bigText)).toBe(true);
  });
});

describe("chunkText", () => {
  it("retourne un seul bloc pour un texte court", () => {
    const chunks = chunkText("Paragraphe unique.\n\nDeuxième paragraphe.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].hasOverlapBefore).toBe(false);
    expect(chunks[0].hasOverlapAfter).toBe(false);
  });

  it("découpe un texte long en plusieurs blocs avec chevauchement", () => {
    const paragraphs = Array.from({ length: 200 }, (_, i) => `Paragraphe numéro ${i} avec un peu de texte pour occuper de la place.`);
    const bigText = paragraphs.join("\n\n");
    const chunks = chunkText(bigText, 200, 50); // seuils réduits pour forcer le découpage dans le test
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].hasOverlapAfter).toBe(true);
    expect(chunks[chunks.length - 1].hasOverlapBefore).toBe(true);
  });
});

describe("mergePartialGraphs", () => {
  it("retourne le résultat unique tel quel avec merge_info à 1 chunk", () => {
    const only = makeAnalysis({ nodes: [{ sequence: 1, function_code: "F01", function_name: "Départ", function_family: "Rupture initiale", actants: ["A"], modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 }, tension: 0.2, phase: "Exposition", text_excerpt: "…", justification: "…" }] });
    const chunks = chunkText(only.summary); // un seul chunk trivial
    const merged = mergePartialGraphs([only], chunks);
    expect(merged.analysis.nodes).toHaveLength(1);
    expect(merged.mergeInfo.nChunks).toBe(1);
  });

  it("fusionne et déduplique les nœuds similaires en zone de recouvrement", () => {
    const node = (seq: number, excerpt: string) => ({
      sequence: seq, function_code: "F10", function_name: "Rencontre", function_family: "Quête et cheminement",
      actants: ["Roméo", "Juliette"], modalities: { vouloir: 0.8, devoir: 0.1, pouvoir: 0.4, savoir: 0.3 },
      tension: 0.3, phase: "Exposition", text_excerpt: excerpt, justification: "…",
    });
    const partA = makeAnalysis({ nodes: [node(1, "Roméo aperçoit Juliette au bal masqué chez les Capulet")] });
    const partB = makeAnalysis({ nodes: [node(1, "Roméo aperçoit Juliette au bal masqué chez les Capulet ce soir-là"), { ...node(2, "Ils échangent leurs premiers mots dans le jardin"), function_code: "F50", function_name: "Amour" }] });
    const chunks = chunkText("x".repeat(10)); // stub : seul le nombre de chunks compte pour le test d'adjacence
    const twoChunks = [
      { index: 0, totalChunks: 2, text: "", charStart: 0, charEnd: 1, estimatedTokens: 1, hasOverlapBefore: false, hasOverlapAfter: true },
      { index: 1, totalChunks: 2, text: "", charStart: 1, charEnd: 2, estimatedTokens: 1, hasOverlapBefore: true, hasOverlapAfter: false },
    ];
    const merged = mergePartialGraphs([partA, partB], twoChunks);
    // Le nœud dupliqué (excerpt à >50% de mots communs, même code) doit être éliminé.
    expect(merged.analysis.nodes.length).toBe(2);
    expect(merged.mergeInfo.nDuplicatesRemoved).toBe(1);
    // Renumérotation séquentielle continue.
    expect(merged.analysis.nodes.map((n) => n.sequence)).toEqual([1, 2]);
    void chunks;
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd web && npx vitest run tests/engine/chunker.test.ts`
Expected: FAIL — module `@/lib/engine/extraction/chunker` introuvable

- [ ] **Step 3: Implémenter le chunker**

Port de `narria/llm/chunker.py` en entier (`estimate_tokens`, `needs_chunking`,
`chunk_text`/`_split_paragraphs`/`_split_oversized_paragraph`, `merge_partial_graphs` et
ses fonctions internes).

```typescript
// web/lib/engine/extraction/chunker.ts
/**
 * Découpage des textes longs et fusion des graphes partiels — port fidèle de
 * `narria/llm/chunker.py`.
 */
import type { LlmAnalysis, LlmNode } from "./llm-schema";

const CHARS_PER_TOKEN = 4;
const MODEL_CONTEXT_LIMIT = 200_000;
const SAFETY_MARGIN = 60_000;
export const CHUNK_THRESHOLD_TOKENS = MODEL_CONTEXT_LIMIT - SAFETY_MARGIN; // 140_000
const TARGET_CHUNK_TOKENS = 90_000;
const OVERLAP_TOKENS = 6_000;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.floor((text.length / CHARS_PER_TOKEN) * 1.2);
}

export function needsChunking(text: string): boolean {
  return estimateTokens(text) > CHUNK_THRESHOLD_TOKENS;
}

export interface TextChunk {
  index: number;
  totalChunks: number;
  text: string;
  charStart: number;
  charEnd: number;
  estimatedTokens: number;
  hasOverlapBefore: boolean;
  hasOverlapAfter: boolean;
}

interface ParaSpan {
  text: string;
  start: number;
  end: number;
}

function splitOversizedParagraph(text: string, baseOffset: number, targetChars: number): ParaSpan[] {
  const sentenceRe = /(?<=[.!?])\s+(?=[A-ZÉÈÀÂÎÔÛÜŒÆ])/g;
  const sentences: ParaSpan[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(text))) {
    sentences.push({ text: text.slice(last, m.index).trim(), start: last, end: m.index });
    last = m.index + m[0].length;
  }
  if (last < text.length) sentences.push({ text: text.slice(last).trim(), start: last, end: text.length });

  if (sentences.length >= 3) {
    const pieces: ParaSpan[] = [];
    let currentText: string[] = [];
    let currentStart = sentences[0].start;
    let currentEnd = sentences[0].start;
    let currentSize = 0;

    for (const s of sentences) {
      const sLen = s.end - s.start;
      if (currentSize + sLen > targetChars && currentText.length > 0) {
        pieces.push({ text: currentText.join(" "), start: baseOffset + currentStart, end: baseOffset + currentEnd });
        currentText = [s.text];
        currentStart = s.start;
        currentEnd = s.end;
        currentSize = sLen;
      } else {
        if (currentText.length === 0) currentStart = s.start;
        currentText.push(s.text);
        currentEnd = s.end;
        currentSize += sLen;
      }
    }
    if (currentText.length > 0) {
      pieces.push({ text: currentText.join(" "), start: baseOffset + currentStart, end: baseOffset + currentEnd });
    }
    const allReasonable = pieces.every((p) => p.end - p.start <= targetChars * 1.2);
    if (allReasonable) return pieces;
  }

  // Fallback : découpage brut par blocs de caractères, en cherchant une frontière propre.
  const pieces: ParaSpan[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + targetChars, text.length);
    if (end < text.length) {
      for (let bp = end; bp > Math.max(end - 200, pos + 1); bp--) {
        if (" .!?".includes(text[bp])) {
          end = bp + 1;
          break;
        }
      }
    }
    pieces.push({ text: text.slice(pos, end).trim(), start: baseOffset + pos, end: baseOffset + end });
    pos = end;
  }
  return pieces;
}

function splitParagraphs(text: string): ParaSpan[] {
  const paragraphs: ParaSpan[] = [];
  const pattern = /\n\s*\n/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const paraText = text.slice(lastEnd, m.index).trim();
    if (paraText) {
      let realStart = lastEnd;
      while (realStart < m.index && /\s/.test(text[realStart])) realStart++;
      paragraphs.push({ text: paraText, start: realStart, end: m.index });
    }
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) {
    const paraText = text.slice(lastEnd).trim();
    if (paraText) {
      let realStart = lastEnd;
      while (realStart < text.length && /\s/.test(text[realStart])) realStart++;
      paragraphs.push({ text: paraText, start: realStart, end: text.length });
    }
  }
  if (paragraphs.length === 0 && text.trim()) {
    paragraphs.push({ text: text.trim(), start: 0, end: text.length });
  }

  const maxParaChars = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
  const refined: ParaSpan[] = [];
  for (const p of paragraphs) {
    if (p.end - p.start <= maxParaChars) {
      refined.push(p);
    } else {
      refined.push(...splitOversizedParagraph(p.text, p.start, maxParaChars));
    }
  }
  return refined;
}

export function chunkText(
  text: string,
  targetTokens: number = TARGET_CHUNK_TOKENS,
  overlapTokens: number = OVERLAP_TOKENS,
): TextChunk[] {
  if (!text || !text.trim()) return [];

  if (estimateTokens(text) <= targetTokens) {
    return [
      {
        index: 0,
        totalChunks: 1,
        text,
        charStart: 0,
        charEnd: text.length,
        estimatedTokens: estimateTokens(text),
        hasOverlapBefore: false,
        hasOverlapAfter: false,
      },
    ];
  }

  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const paragraphs = splitParagraphs(text);

  const chunksRaw: ParaSpan[] = [];
  let currentParas: ParaSpan[] = [];
  let currentSize = 0;

  function finalizeCurrent() {
    if (currentParas.length === 0) return;
    chunksRaw.push({
      text: currentParas.map((p) => p.text).join("\n\n"),
      start: currentParas[0].start,
      end: currentParas[currentParas.length - 1].end,
    });
  }

  function computeOverlapParas(): { paras: ParaSpan[]; size: number } {
    const overlapParas: ParaSpan[] = [];
    let overlapSize = 0;
    for (let i = currentParas.length - 1; i >= 0; i--) {
      const op = currentParas[i];
      const opLen = op.end - op.start;
      if (overlapSize + opLen > overlapChars && overlapParas.length > 0) break;
      overlapParas.unshift(op);
      overlapSize += opLen;
      if (overlapSize >= overlapChars) break;
    }
    return { paras: overlapParas, size: overlapSize };
  }

  for (const p of paragraphs) {
    const pLen = p.end - p.start;

    if (pLen > targetChars) {
      if (currentParas.length > 0) {
        finalizeCurrent();
        currentParas = [];
        currentSize = 0;
      }
      chunksRaw.push({ text: p.text, start: p.start, end: p.end });
      continue;
    }

    if (currentSize + pLen > targetChars && currentParas.length > 0) {
      finalizeCurrent();
      const { paras, size } = computeOverlapParas();
      currentParas = paras;
      currentSize = size;
      if (currentSize + pLen > targetChars && currentParas.length > 0) {
        finalizeCurrent();
        currentParas = [];
        currentSize = 0;
      }
    }

    currentParas.push(p);
    currentSize += pLen;
  }
  finalizeCurrent();

  const total = chunksRaw.length;
  return chunksRaw.map((c, i) => ({
    index: i,
    totalChunks: total,
    text: c.text,
    charStart: c.start,
    charEnd: c.end,
    estimatedTokens: estimateTokens(c.text),
    hasOverlapBefore: i > 0,
    hasOverlapAfter: i < total - 1,
  }));
}

// ─── Fusion des graphes partiels (port de merge_partial_graphs) ───

function mostCommon(values: string[]): string {
  if (values.length === 0) return "";
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function synthesizeSummaries(summaries: string[]): string {
  if (summaries.length === 0) return "";
  if (summaries.length === 1) return summaries[0];
  return summaries.map((s, i) => `Partie ${i + 1}/${summaries.length} : ${s}`).join(" ");
}

const ACTANT_KEYS = ["protagoniste", "objet", "destinateur", "destinataire", "adjuvant", "opposant"] as const;

function mergeActantConfig(
  configs: LlmAnalysis["main_actants_v1"][],
  focus: string,
  description: string,
): LlmAnalysis["main_actants_v1"] {
  const merged: Record<string, string> = { _focus: focus, _description: description };
  for (const key of ACTANT_KEYS) {
    const values = configs.map((c) => (c[key] ?? "").trim()).filter(Boolean);
    if (values.length > 0) merged[key] = mostCommon(values);
  }
  return merged as LlmAnalysis["main_actants_v1"];
}

function isDuplicateNode(a: LlmNode, b: LlmNode): boolean {
  if (a.function_code && b.function_code && a.function_code !== b.function_code) return false;
  const textA = (a.text_excerpt ?? "").toLowerCase();
  const textB = (b.text_excerpt ?? "").toLowerCase();
  if (!textA || !textB) return false;
  const wordsA = new Set((textA.match(/\w{4,}/g) ?? []));
  const wordsB = new Set((textB.match(/\w{4,}/g) ?? []));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const smaller = Math.min(wordsA.size, wordsB.size);
  return smaller > 0 && intersection / smaller > 0.5;
}

function deduplicateOverlapNodes(
  allNodes: (LlmNode & { _chunkIndex: number })[],
): (LlmNode & { _chunkIndex: number })[] {
  if (allNodes.length <= 1) return allNodes;
  const keep = allNodes.map(() => true);

  for (let i = 0; i < allNodes.length; i++) {
    if (!keep[i]) continue;
    const chunkI = allNodes[i]._chunkIndex;
    for (let j = i + 1; j < allNodes.length; j++) {
      if (!keep[j]) continue;
      const chunkJ = allNodes[j]._chunkIndex;
      if (Math.abs(chunkJ - chunkI) > 1) break;
      if (chunkJ === chunkI) continue;
      if (isDuplicateNode(allNodes[i], allNodes[j])) keep[j] = false;
    }
  }
  return allNodes.filter((_, i) => keep[i]);
}

export interface MergeInfo {
  nChunks: number;
  nNodesBeforeDedup: number;
  nNodesAfterDedup: number;
  nDuplicatesRemoved: number;
}

export interface MergedResult {
  analysis: LlmAnalysis;
  mergeInfo: MergeInfo;
}

export function mergePartialGraphs(partialResults: LlmAnalysis[], chunks: TextChunk[]): MergedResult {
  void chunks; // conservé pour signature fidèle au Python ; le découpage par chunk est déjà encodé dans _chunkIndex

  if (partialResults.length === 0) {
    throw new Error("mergePartialGraphs: aucun résultat partiel à fusionner.");
  }

  if (partialResults.length === 1) {
    const only = partialResults[0];
    return {
      analysis: only,
      mergeInfo: {
        nChunks: 1,
        nNodesBeforeDedup: only.nodes.length,
        nNodesAfterDedup: only.nodes.length,
        nDuplicatesRemoved: 0,
      },
    };
  }

  const genres = partialResults.map((r) => r.genre).filter(Boolean);
  const traditions = partialResults.map((r) => r.tradition).filter(Boolean);
  const globalGenre = mostCommon(genres);
  const globalTradition = mostCommon(traditions);

  const summaries = partialResults.map((r) => r.summary).filter(Boolean);
  const globalSummary = synthesizeSummaries(summaries);

  const allKeywords: string[] = [];
  for (const r of partialResults) {
    for (const kw of r.thematic_keywords ?? []) {
      if (kw && !allKeywords.includes(kw)) allKeywords.push(kw);
    }
  }

  const mainActantsV1 = mergeActantConfig(
    partialResults.map((r) => r.main_actants_v1),
    "agent_actif",
    "Configuration où le Sujet est l'agent qui pose et conduit l'action principale",
  );
  const mainActantsV2 = mergeActantConfig(
    partialResults.map((r) => r.main_actants_v2),
    "patient_central",
    "Configuration où le Sujet est celui qui subit l'action principale ou en est l'enjeu",
  );

  const allNodes: (LlmNode & { _chunkIndex: number })[] = [];
  partialResults.forEach((result, chunkIdx) => {
    for (const node of result.nodes) allNodes.push({ ...node, _chunkIndex: chunkIdx });
  });

  const nBefore = allNodes.length;
  const deduped = deduplicateOverlapNodes(allNodes);
  const nAfter = deduped.length;

  const renumbered: LlmNode[] = deduped.map((node, i) => {
    const { _chunkIndex, ...rest } = node;
    void _chunkIndex;
    return { ...rest, sequence: i + 1 };
  });

  const formalFeatures = partialResults[0].formal_features;

  return {
    analysis: {
      summary: globalSummary,
      genre: globalGenre,
      tradition: globalTradition,
      formal_features: formalFeatures,
      nodes: renumbered,
      main_actants_v1: mainActantsV1,
      main_actants_v2: mainActantsV2,
      thematic_keywords: allKeywords.slice(0, 20),
    },
    mergeInfo: {
      nChunks: partialResults.length,
      nNodesBeforeDedup: nBefore,
      nNodesAfterDedup: nAfter,
      nDuplicatesRemoved: nBefore - nAfter,
    },
  };
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `cd web && npx vitest run tests/engine/chunker.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd web && git add lib/engine/extraction/chunker.ts tests/engine/chunker.test.ts
git commit -m "feat(engine): chunking des textes longs + fusion de graphes partiels"
```

---

### Task 5: Orchestration de l'extraction LLM (llm-extractor.ts)

**Files:**
- Create: `web/lib/engine/extraction/llm-extractor.ts`
- Modify: `web/lib/engine/models.ts`
- Modify: `web/lib/engine/index.ts`

- [ ] **Step 1: Étendre `NarrativeGraph.metadata` avec les champs LLM**

Le type `metadata: Record<string, unknown>` existant accepte déjà n'importe quel champ,
mais on documente sa forme enrichie pour la suite (composants, export) :

```typescript
// web/lib/engine/models.ts
// Ajouter à la fin du fichier, après tensionProfile() :

export interface LlmAnalysisMetadata {
  mode: "llm";
  summary: string;
  genre: string;
  tradition: string;
  formalFeatures: Record<string, unknown>;
  mainActants: {
    v1: Record<string, string>;
    v2: Record<string, string>;
  };
  thematicKeywords: string[];
  costUsd: number;
  tokensTotal: number;
  mergeInfo?: { nChunks: number; nNodesBeforeDedup: number; nNodesAfterDedup: number; nDuplicatesRemoved: number };
}
```

- [ ] **Step 2: Implémenter `llm-extractor.ts`**

Mapping des champs `snake_case` du LLM vers le `NarrativeGraph` `camelCase` existant
(`nodeId`, `functionCode`, etc. — même forme que `heuristic-extractor.ts`).

```typescript
// web/lib/engine/extraction/llm-extractor.ts
/**
 * Extraction narratologique via Claude — port de `narria/llm/claude_client.py`
 * (analyze_narrative) avec chunking (`narria/llm/chunker.py`) pour les textes longs.
 */
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SYSTEM_PROMPT_NARRATOLOGY, buildUserPrompt, type PromptMeta } from "./llm-prompts";
import { LlmAnalysisSchema, enforceCulturalRestriction, type LlmAnalysis, type LlmNode } from "./llm-schema";
import { needsChunking, chunkText, mergePartialGraphs, type TextChunk } from "./chunker";
import type { NarrativeGraph, NarrativeNode, LlmAnalysisMetadata } from "../models";

export const EXTRACTION_MODEL_ID = "claude-sonnet-4-6";
const PRICE_INPUT_PER_MTOK = 3.0;
const PRICE_OUTPUT_PER_MTOK = 15.0;

export interface LlmExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

function costFromUsage(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_INPUT_PER_MTOK + outputTokens * PRICE_OUTPUT_PER_MTOK) / 1_000_000;
}

async function analyzeChunk(text: string, meta: PromptMeta): Promise<{ analysis: LlmAnalysis; usage: LlmExtractionUsage }> {
  const result = await generateObject({
    model: anthropic(EXTRACTION_MODEL_ID),
    system: SYSTEM_PROMPT_NARRATOLOGY,
    prompt: buildUserPrompt(text, meta),
    schema: LlmAnalysisSchema,
    maxRetries: 2,
  });

  const analysis = enforceCulturalRestriction(result.object);
  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;

  return {
    analysis,
    usage: { inputTokens, outputTokens, costUsd: costFromUsage(inputTokens, outputTokens) },
  };
}

function nodeIdFor(index: number): string {
  return `n${String(index + 1).padStart(3, "0")}`;
}

function toNarrativeNode(node: LlmNode, index: number): NarrativeNode {
  return {
    nodeId: nodeIdFor(index),
    segmentId: `seg_${nodeIdFor(index)}`,
    functionCode: node.function_code || null,
    functionFamily: node.function_family || null,
    functionName: node.function_name || null,
    actants: node.actants,
    modalities: node.modalities,
    tension: node.tension,
    phase: node.phase || null,
    textExcerpt: node.text_excerpt,
  };
}

export interface LlmAnalysisMeta {
  title?: string;
  author?: string;
}

export interface LlmAnalysisOutcome {
  graph: NarrativeGraph;
  usage: LlmExtractionUsage;
}

/** Analyse LLM complète d'un texte → graphe narratif enrichi (mode par défaut de /api/analyze). */
export async function analyzeLLM(text: string, meta: LlmAnalysisMeta = {}): Promise<LlmAnalysisOutcome> {
  const promptMeta: PromptMeta = { title: meta.title, author: meta.author };

  let merged: LlmAnalysis;
  let totalUsage: LlmExtractionUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let mergeInfo: LlmAnalysisMetadata["mergeInfo"];

  if (!needsChunking(text)) {
    const { analysis, usage } = await analyzeChunk(text, promptMeta);
    merged = analysis;
    totalUsage = usage;
  } else {
    const chunks: TextChunk[] = chunkText(text);
    const partials: LlmAnalysis[] = [];
    for (const chunk of chunks) {
      const { analysis, usage } = await analyzeChunk(chunk.text, promptMeta);
      partials.push(analysis);
      totalUsage = {
        inputTokens: totalUsage.inputTokens + usage.inputTokens,
        outputTokens: totalUsage.outputTokens + usage.outputTokens,
        costUsd: totalUsage.costUsd + usage.costUsd,
      };
    }
    const mergedResult = mergePartialGraphs(partials, chunks);
    merged = mergedResult.analysis;
    mergeInfo = mergedResult.mergeInfo;
  }

  const nodes = merged.nodes.map(toNarrativeNode);

  const metadata: LlmAnalysisMetadata = {
    mode: "llm",
    summary: merged.summary,
    genre: merged.genre,
    tradition: merged.tradition,
    formalFeatures: merged.formal_features,
    mainActants: { v1: merged.main_actants_v1, v2: merged.main_actants_v2 },
    thematicKeywords: merged.thematic_keywords,
    costUsd: totalUsage.costUsd,
    tokensTotal: totalUsage.inputTokens + totalUsage.outputTokens,
    mergeInfo,
  };

  const graph: NarrativeGraph = {
    graphId: `g_llm_${Date.now().toString(36)}`,
    metadata: {
      title: meta.title ?? "Texte sans titre",
      author: meta.author ?? "Auteur inconnu",
      ...metadata,
    },
    nodes,
    edges: [],
  };

  return { graph, usage: totalUsage };
}
```

- [ ] **Step 3: Exporter depuis `web/lib/engine/index.ts`**

```typescript
// web/lib/engine/index.ts
// Ajouter avec les autres exports :
export { analyzeLLM } from "./extraction/llm-extractor";
export type { LlmAnalysisMeta, LlmAnalysisOutcome } from "./extraction/llm-extractor";
```

- [ ] **Step 4: Vérification manuelle (nécessite `ANTHROPIC_API_KEY` en local)**

Run:
```bash
cd web && node --experimental-strip-types -e "
import('./lib/engine/extraction/llm-extractor.ts').then(async (m) => {
  const { graph } = await m.analyzeLLM('Un corbeau tenant un fromage se fait flatter par un renard rusé, qui le lui vole en le poussant à chanter.', { title: 'Test', author: 'Test' });
  console.log(graph.nodes.length, graph.metadata.summary);
});
"
```
Expected: un nombre de nœuds ≥5 et un résumé non vide affichés en console, sans erreur.
(Si le runtime ne supporte pas `--experimental-strip-types`, faire ce test via une petite
route API temporaire ou directement lors du Task 6 en branchant `/api/analyze`.)

- [ ] **Step 5: Commit**

```bash
cd web && git add lib/engine/extraction/llm-extractor.ts lib/engine/models.ts lib/engine/index.ts
git commit -m "feat(engine): orchestration extraction LLM (generateObject + chunking)"
```

---

### Task 6: Modèle Mongoose + route /api/analyze en mode LLM par défaut

**Files:**
- Modify: `web/lib/db/models/analysis.ts`
- Modify: `web/app/api/analyze/route.ts`

- [ ] **Step 1: Étendre le schéma Mongoose `Analysis`**

```typescript
// web/lib/db/models/analysis.ts
import { Schema, model, models } from "mongoose";

/** Analyse d'un texte : graphe narratif (NarRep-Graph) + métadonnées. */
const AnalysisSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, default: "Texte sans titre" },
    author: { type: String, default: "Auteur inconnu" },
    mode: { type: String, enum: ["heuristic", "llm"], default: "llm" },
    wordCount: { type: Number, default: 0 },
    nNodes: { type: Number, default: 0 },
    graph: { type: Schema.Types.Mixed, required: true },
    costTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    summary: { type: String, default: "" },
    genre: { type: String, default: "" },
    tradition: { type: String, default: "" },
    mainActants: { type: Schema.Types.Mixed, default: null },
    thematicKeywords: { type: [String], default: [] },
    formalFeatures: { type: Schema.Types.Mixed, default: null },
    sourceFile: {
      type: new Schema(
        { filename: String, format: String, warnings: [String] },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

export const Analysis = models.Analysis || model("Analysis", AnalysisSchema);
```

- [ ] **Step 2: Basculer `/api/analyze` sur `analyzeLLM`**

```typescript
// web/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { analyzeLLM, functionSequence } from "@/lib/engine";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Clé ANTHROPIC_API_KEY manquante côté serveur." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const text: string = body?.text ?? "";
  const title: string = body?.title || "Texte sans titre";
  const author: string = body?.author || "Auteur inconnu";
  const sourceFile = body?.sourceFile ?? null; // { filename, format, warnings } optionnel, transmis depuis FileDropzone

  if (text.trim().length < 200) {
    return NextResponse.json(
      { error: "Le texte doit contenir au moins 200 caractères (≈ 30 mots)." },
      { status: 400 },
    );
  }

  let graph;
  let usage;
  try {
    ({ graph, usage } = await analyzeLLM(text, { title, author }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur lors de l'analyse LLM.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const wordCount = text.trim().split(/\s+/).length;
  const meta = graph.metadata as Record<string, unknown>;

  await connectDB();
  const doc = await Analysis.create({
    ownerId: session.user.id,
    title,
    author,
    mode: "llm",
    wordCount,
    nNodes: graph.nodes.length,
    graph,
    costTokens: usage.inputTokens + usage.outputTokens,
    costUsd: usage.costUsd,
    summary: meta.summary,
    genre: meta.genre,
    tradition: meta.tradition,
    mainActants: meta.mainActants,
    thematicKeywords: meta.thematicKeywords,
    formalFeatures: meta.formalFeatures,
    sourceFile,
  });

  await createNotification({
    ownerId: session.user.id,
    type: "analysis",
    title: `Analyse terminée — « ${title} »`,
    body: `L'analyse narrative de votre œuvre est prête. ${graph.nodes.length} nœuds narratifs détectés.`,
    href: "/historique",
  });

  return NextResponse.json({
    id: String(doc._id),
    title,
    author,
    mode: "llm",
    nNodes: graph.nodes.length,
    wordCount,
    functionSequence: functionSequence(graph),
    nodes: graph.nodes,
    summary: meta.summary,
    genre: meta.genre,
    tradition: meta.tradition,
    mainActants: meta.mainActants,
    thematicKeywords: meta.thematicKeywords,
    costUsd: usage.costUsd,
    tokensTotal: usage.inputTokens + usage.outputTokens,
  });
}
```

- [ ] **Step 3: Vérification manuelle**

Run: `cd web && npm run dev`
Sur `/analyser`, lancer une analyse avec un texte réel (≥200 caractères) : la réponse
réseau (`/api/analyze`, onglet Network du navigateur) doit contenir `summary`, `genre`,
`tradition`, `mainActants.v1/v2`, `thematicKeywords`, `costUsd`, `tokensTotal`.

- [ ] **Step 4: Commit**

```bash
cd web && git add lib/db/models/analysis.ts app/api/analyze/route.ts
git commit -m "feat(analyse): mode LLM par défaut sur /api/analyze + champs enrichis en base"
```

---

### Task 7: Géométrie et composant du schéma actantiel

**Files:**
- Create: `web/lib/reports/actantial-geometry.ts`
- Create: `web/components/analyse/actantial-diagram.tsx`
- Test: `web/tests/reports/actantial-geometry.test.ts`

- [ ] **Step 1: Écrire le test de géométrie (échoue)**

```typescript
// web/tests/reports/actantial-geometry.test.ts
import { describe, it, expect } from "vitest";
import { getActantialLayout, truncateActantLabel, ACTANTIAL_DIMENSIONS } from "@/lib/reports/actantial-geometry";

describe("ACTANTIAL_DIMENSIONS", () => {
  it("reproduit les dimensions exactes du SVG Python (W=720, H=360, boxW=140, boxH=50)", () => {
    expect(ACTANTIAL_DIMENSIONS).toEqual({ width: 720, height: 360, boxWidth: 140, boxHeight: 50 });
  });
});

describe("truncateActantLabel", () => {
  it("tronque à 22 caractères avec une ellipse, comme trunc() en Python", () => {
    const long = "Passion amoureuse réciproque et dévorante";
    expect(truncateActantLabel(long)).toBe("Passion amoureuse réc…");
    expect(truncateActantLabel(long).length).toBe(22);
  });

  it("retourne un tiret cadratin pour une valeur vide", () => {
    expect(truncateActantLabel("")).toBe("—");
    expect(truncateActantLabel(undefined)).toBe("—");
  });

  it("ne tronque pas une valeur déjà courte", () => {
    expect(truncateActantLabel("Roméo")).toBe("Roméo");
  });
});

describe("getActantialLayout", () => {
  it("place les 6 cartouches aux positions exactes du SVG Python", () => {
    const layout = getActantialLayout({
      protagoniste: "Roméo et Juliette",
      objet: "Union amoureuse malgré l'interdit familial",
      destinateur: "Passion amoureuse réciproque",
      destinataire: "Eux-mêmes",
      adjuvant: "Frère Laurent",
      opposant: "Haine familiale ancestrale",
    });
    const byKey = Object.fromEntries(layout.boxes.map((b) => [b.key, b]));
    expect(byKey.destinateur.cx).toBe(130);
    expect(byKey.destinateur.cy).toBe(80);
    expect(byKey.objet.cx).toBe(360);
    expect(byKey.objet.cy).toBe(80);
    expect(byKey.destinataire.cx).toBe(590);
    expect(byKey.destinataire.cy).toBe(80);
    expect(byKey.adjuvant.cx).toBe(130);
    expect(byKey.adjuvant.cy).toBe(280);
    expect(byKey.sujet.cx).toBe(360);
    expect(byKey.sujet.cy).toBe(280);
    expect(byKey.opposant.cx).toBe(590);
    expect(byKey.opposant.cy).toBe(280);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd web && npx vitest run tests/reports/actantial-geometry.test.ts`
Expected: FAIL — module `@/lib/reports/actantial-geometry` introuvable

- [ ] **Step 3: Implémenter la géométrie**

Port exact de `_render_actantial_svg` (lignes 2394-2470 de `narria/app.py`) : `W=720,
H=360, boxW=140, boxH=50`, positions `cx=130/360/590`, `cy=80` (ligne haute) et `cy=280`
(ligne basse, car `H - 80 = 280`).

```typescript
// web/lib/reports/actantial-geometry.ts
/**
 * Géométrie pure du schéma actantiel greimassien — port de
 * `narria/app.py::_render_actantial_svg`. Consommée par le composant React
 * (thème sombre) et par le template d'export HTML (palette d'origine) : ne
 * pas dupliquer les positions ailleurs.
 */

export const ACTANTIAL_DIMENSIONS = { width: 720, height: 360, boxWidth: 140, boxHeight: 50 };

export type ActantKey = "destinateur" | "objet" | "destinataire" | "adjuvant" | "sujet" | "opposant";

export interface MainActants {
  protagoniste: string;
  objet: string;
  destinateur: string;
  destinataire: string;
  adjuvant: string;
  opposant: string;
}

export function truncateActantLabel(value: string | undefined, maxLen = 22): string {
  const s = (value ?? "").trim();
  if (!s) return "—";
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "…";
}

export interface ActantialBox {
  key: ActantKey;
  label: string; // libellé du rôle (ex. "DESTINATEUR")
  value: string; // valeur tronquée à afficher
  cx: number;
  cy: number;
}

export interface ActantialLayout {
  dimensions: typeof ACTANTIAL_DIMENSIONS;
  boxes: ActantialBox[];
}

export function getActantialLayout(actants: MainActants): ActantialLayout {
  const { width: W, height: H } = ACTANTIAL_DIMENSIONS;
  const topY = 80;
  const bottomY = H - 80; // 280

  const boxes: ActantialBox[] = [
    { key: "destinateur", label: "DESTINATEUR", value: truncateActantLabel(actants.destinateur), cx: 130, cy: topY },
    { key: "objet", label: "OBJET", value: truncateActantLabel(actants.objet), cx: W / 2, cy: topY },
    { key: "destinataire", label: "DESTINATAIRE", value: truncateActantLabel(actants.destinataire), cx: W - 130, cy: topY },
    { key: "adjuvant", label: "ADJUVANT", value: truncateActantLabel(actants.adjuvant), cx: 130, cy: bottomY },
    { key: "sujet", label: "SUJET", value: truncateActantLabel(actants.protagoniste), cx: W / 2, cy: bottomY },
    { key: "opposant", label: "OPPOSANT", value: truncateActantLabel(actants.opposant), cx: W - 130, cy: bottomY },
  ];

  return { dimensions: ACTANTIAL_DIMENSIONS, boxes };
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `cd web && npx vitest run tests/reports/actantial-geometry.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Implémenter le composant React `ActantialDiagram`**

Reprend les mêmes axes/flèches que le SVG Python mais recoloré aux tokens du thème sombre
de l'app (`var(--color-...)` déjà utilisés ailleurs dans le projet — mêmes noms que
`components/ui/badge.tsx` : `soft-purple`, `soft-pink`, `muted`, `border`).

```tsx
// web/components/analyse/actantial-diagram.tsx
import { getActantialLayout, type MainActants } from "@/lib/reports/actantial-geometry";

interface ActantialDiagramProps {
  actants: MainActants;
}

const BOX_STYLES: Record<string, { stroke: string; fill: string; text: string }> = {
  destinateur: { stroke: "#f472b6", fill: "rgba(244,114,182,0.12)", text: "#f9a8d4" },
  destinataire: { stroke: "#f472b6", fill: "rgba(244,114,182,0.12)", text: "#f9a8d4" },
  objet: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.12)", text: "#c4b5fd" },
  sujet: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.12)", text: "#c4b5fd" },
  adjuvant: { stroke: "#9ca3af", fill: "rgba(156,163,175,0.10)", text: "#d1d5db" },
  opposant: { stroke: "#9ca3af", fill: "rgba(156,163,175,0.10)", text: "#d1d5db" },
};

export function ActantialDiagram({ actants }: ActantialDiagramProps) {
  const { dimensions, boxes } = getActantialLayout(actants);
  const { width: W, height: H, boxWidth: boxW, boxHeight: boxH } = dimensions;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" className="max-w-[560px]">
        {/* Axe du désir (vertical) */}
        <line x1={W / 2} y1={H - 80 - boxH / 2 - 5} x2={W / 2} y2={80 + boxH / 2 + 5} stroke="#a78bfa" strokeWidth={3} />
        <polygon points={`${W / 2 - 6},${80 + boxH / 2 + 10} ${W / 2 + 6},${80 + boxH / 2 + 10} ${W / 2},${80 + boxH / 2 + 2}`} fill="#a78bfa" />
        <text x={W / 2 + 10} y={H / 2} fontFamily="sans-serif" fontSize={9} fill="#a78bfa" fontWeight="bold">
          AXE DU DÉSIR
        </text>

        {/* Axe de communication (horizontal, haut) */}
        <line x1={130 + boxW / 2 + 5} y1={80} x2={W - 130 - boxW / 2 - 5} y2={80} stroke="#f472b6" strokeWidth={2} />
        <polygon points={`${W - 130 - boxW / 2 - 3},75 ${W - 130 - boxW / 2 - 3},85 ${W - 130 - boxW / 2 + 5},80`} fill="#f472b6" />
        <text x={W / 2} y={35} textAnchor="middle" fontFamily="sans-serif" fontSize={9} fill="#f472b6" fontWeight="bold">
          AXE DE COMMUNICATION
        </text>

        {/* Axes de pouvoir (bas, adjuvant → sujet plein, sujet → opposant pointillé) */}
        <line x1={130 + boxW / 2 + 5} y1={H - 80} x2={W / 2 - boxW / 2 - 5} y2={H - 80} stroke="#9ca3af" strokeWidth={2} />
        <polygon points={`${W / 2 - boxW / 2 - 3},${H - 85} ${W / 2 - boxW / 2 - 3},${H - 75} ${W / 2 - boxW / 2 + 5},${H - 80}`} fill="#9ca3af" />
        <line x1={W - 130 - boxW / 2 - 5} y1={H - 80} x2={W / 2 + boxW / 2 + 5} y2={H - 80} stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 3" />
        <polygon points={`${W / 2 + boxW / 2 + 3},${H - 85} ${W / 2 + boxW / 2 + 3},${H - 75} ${W / 2 + boxW / 2 - 5},${H - 80}`} fill="#9ca3af" />

        {/* Cartouches */}
        {boxes.map((box) => {
          const style = BOX_STYLES[box.key];
          const x = box.cx - boxW / 2;
          const y = box.cy - boxH / 2;
          return (
            <g key={box.key}>
              <rect x={x} y={y} width={boxW} height={boxH} rx={6} ry={6} fill={style.fill} stroke={style.stroke} strokeWidth={2} />
              <text x={box.cx} y={box.cy - 6} textAnchor="middle" fontFamily="sans-serif" fontSize={10} fill={style.stroke} fontWeight="bold">
                {box.label}
              </text>
              <text x={box.cx} y={box.cy + 14} textAnchor="middle" fontFamily="sans-serif" fontSize={11} fill={style.text} fontStyle="italic">
                {box.value}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-center text-xs italic text-muted">
        Schéma actantiel d&apos;après A. J. Greimas (Sémantique structurale, 1966).
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd web && git add lib/reports/actantial-geometry.ts components/analyse/actantial-diagram.tsx tests/reports/actantial-geometry.test.ts
git commit -m "feat(rapport): géométrie + composant du schéma actantiel"
```

---

### Task 8: Composant AnalysisReport + intégration dans /analyser

**Files:**
- Create: `web/components/analyse/analysis-report.tsx`
- Modify: `web/app/(app)/analyser/page.tsx`

- [ ] **Step 1: Implémenter `AnalysisReport`**

Reprend toutes les sections de `_render_analysis_html` (synthèse, tableau actantiel + SVG,
graphe narratif détaillé avec modalités et citation, ligne de coût), thème sombre de
l'app.

```tsx
// web/components/analyse/analysis-report.tsx
import { BookOpen, Sparkles } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActantialDiagram } from "@/components/analyse/actantial-diagram";
import type { MainActants } from "@/lib/reports/actantial-geometry";

export interface AnalysisReportNode {
  nodeId: string;
  functionCode: string | null;
  functionName: string | null;
  functionFamily: string | null;
  actants: string[];
  modalities: { vouloir: number; devoir: number; pouvoir: number; savoir: number };
  tension: number;
  phase: string | null;
  textExcerpt: string;
}

export interface AnalysisReportData {
  title: string;
  author: string;
  mode: string;
  summary?: string;
  genre?: string;
  tradition?: string;
  mainActants?: { v1: MainActants; v2: MainActants };
  thematicKeywords?: string[];
  nodes: AnalysisReportNode[];
  costUsd?: number;
  tokensTotal?: number;
}

const ACTANT_ROWS: { key: keyof MainActants; label: string }[] = [
  { key: "protagoniste", label: "Sujet (protagoniste)" },
  { key: "objet", label: "Objet de la quête" },
  { key: "destinateur", label: "Destinateur" },
  { key: "destinataire", label: "Destinataire" },
  { key: "adjuvant", label: "Adjuvant" },
  { key: "opposant", label: "Opposant" },
];

export function AnalysisReport({ data }: { data: AnalysisReportData }) {
  const actantsV1 = data.mainActants?.v1;

  return (
    <div className="space-y-6">
      {(data.summary || data.genre || actantsV1) && (
        <Card className="space-y-4 border-l-4 border-l-soft-pink">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-soft-pink" /> Synthèse de l&apos;analyse
          </CardTitle>
          {data.summary && <p className="text-sm text-foreground">{data.summary}</p>}
          <div className="flex flex-wrap gap-4 text-sm">
            {data.genre && (
              <p>
                <span className="font-semibold text-foreground">Genre : </span>
                <span className="text-muted">{data.genre}</span>
              </p>
            )}
            {data.tradition && (
              <p>
                <span className="font-semibold text-foreground">Tradition narrative : </span>
                <span className="text-muted">{data.tradition}</span>
              </p>
            )}
          </div>
          {data.thematicKeywords && data.thematicKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.thematicKeywords.map((kw) => (
                <Badge key={kw} tone="pink">{kw}</Badge>
              ))}
            </div>
          )}

          {actantsV1 && (
            <div className="space-y-4 pt-2">
              <h3 className="font-heading text-sm font-bold text-soft-purple">Schéma actantiel identifié</h3>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {ACTANT_ROWS.map((row) => (
                      <tr key={row.key} className="border-b border-border last:border-0">
                        <td className="w-1/3 bg-surface-2 px-3 py-2 font-semibold text-foreground">{row.label}</td>
                        <td className="px-3 py-2 text-muted">{actantsV1[row.key]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ActantialDiagram actants={actantsV1} />
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-soft-purple" /> Graphe narratif ({data.nodes.length} nœuds)
        </CardTitle>
        <div className="space-y-3">
          {data.nodes.map((n) => (
            <div key={n.nodeId} className="space-y-2 rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-sm font-bold text-soft-purple">{n.nodeId}</span>
                {n.functionCode && <Badge tone={n.functionCode.startsWith("FN") ? "yellow" : "pink"}>{n.functionCode}</Badge>}
                <span className="text-sm text-foreground">{n.functionName}</span>
                {n.functionFamily && <span className="text-xs text-muted">· {n.functionFamily}</span>}
                {n.phase && <Badge tone="neutral">{n.phase}</Badge>}
              </div>
              {n.actants.length > 0 && (
                <p className="text-xs text-muted">Actants : {n.actants.join(", ")}</p>
              )}
              <p className="text-xs text-muted">
                Modalités : vouloir={n.modalities.vouloir.toFixed(2)} · devoir={n.modalities.devoir.toFixed(2)} ·
                pouvoir={n.modalities.pouvoir.toFixed(2)} · savoir={n.modalities.savoir.toFixed(2)}
              </p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-gradient-to-r from-soft-purple to-pink" style={{ width: `${n.tension * 100}%` }} />
                </div>
                <span className="text-xs text-muted">tension {n.tension.toFixed(2)}</span>
              </div>
              {n.textExcerpt && (
                <blockquote className="border-l-2 border-soft-pink/50 pl-3 text-sm italic text-muted">
                  « {n.textExcerpt} »
                </blockquote>
              )}
            </div>
          ))}
        </div>
      </Card>

      {data.mode === "llm" && data.costUsd != null && (
        <p className="text-right text-xs italic text-muted">
          Analyse via Claude — coût : {data.costUsd.toFixed(4)} USD · {(data.tokensTotal ?? 0).toLocaleString("fr-FR")} tokens
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remplacer l'affichage des résultats dans `/analyser`**

```typescript
// web/app/(app)/analyser/page.tsx
// Remplacer l'interface AnalyzeResult existante par :
import { AnalysisReport, type AnalysisReportData } from "@/components/analyse/analysis-report";

interface AnalyzeResult extends AnalysisReportData {
  id: string;
  nNodes: number;
  wordCount: number;
  functionSequence: string[];
}
```

Remplacer le bloc `{result && (<Card>...</Card>)}` (lignes 123-176 de la version
actuelle) par :

```tsx
      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-bold text-foreground">
              Rapport — {result.title}
            </h2>
            <div className="flex gap-2">
              <Badge tone="purple">{result.nNodes} nœuds</Badge>
              <Badge tone="neutral">{result.wordCount} mots</Badge>
            </div>
          </div>
          <AnalysisReport data={result} />
        </div>
      )}
```

- [ ] **Step 3: Adapter `run()` pour transmettre `sourceFile` si un upload a eu lieu**

```typescript
// web/app/(app)/analyser/page.tsx
// Ajouter un état, avec les autres useState :
const [sourceFile, setSourceFile] = useState<{ filename: string; format: string; warnings: string[] } | null>(null);

// Dans le callback onExtracted de FileDropzone (Task 2), enrichir :
//   setSourceFile({ filename: r.sourceFormat, format: r.sourceFormat, warnings: r.warnings });
// (le nom de fichier n'étant pas renvoyé par /api/extract-file aujourd'hui, on utilise
// le format comme identifiant minimal ; suffisant pour l'affichage des warnings)

// Dans run(), transmettre sourceFile dans le body JSON :
    body: JSON.stringify({ text, title, author, sourceFile }),
```

- [ ] **Step 4: Vérification manuelle**

Run: `cd web && npm run dev`
Lancer une analyse complète sur `/analyser` avec un texte réel : la synthèse, le tableau
actantiel, le SVG et le graphe narratif détaillé (avec modalités et citations) doivent
s'afficher, dans le thème sombre de l'app.

- [ ] **Step 5: Commit**

```bash
cd web && git add components/analyse/analysis-report.tsx "app/(app)/analyser/page.tsx"
git commit -m "feat(analyse): rapport complet (synthèse, schéma actantiel, graphe détaillé)"
```

---

### Task 9: Export HTML fidèle à l'original

**Files:**
- Create: `web/lib/reports/analysis-html-report.ts`
- Create: `web/app/api/analyze/[id]/export/route.ts`
- Modify: `web/components/analyse/analysis-report.tsx`

- [ ] **Step 1: Implémenter le template HTML (palette d'origine, port exact)**

Port fidèle de `_render_analysis_html` + `_render_actantial_svg`
(`narria/app.py:2191-2470`), en réutilisant `getActantialLayout` du Task 7 pour les
positions (mais avec les couleurs d'origine, pas celles du thème sombre).

```typescript
// web/lib/reports/analysis-html-report.ts
/**
 * Rendu HTML autoportant d'un rapport d'analyse — port fidèle de
 * `narria/app.py::_render_analysis_html` + `_render_actantial_svg`. Palette et
 * structure identiques à l'original : ne pas recolorer, cet export doit rester
 * fidèle pixel-près à l'ancien rapport NARR'IA.
 */
import { getActantialLayout, type MainActants } from "./actantial-geometry";
import type { AnalysisReportData } from "@/components/analyse/analysis-report";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderActantialSvgOriginalPalette(actants: MainActants): string {
  const { dimensions, boxes } = getActantialLayout(actants);
  const { width: W, height: H, boxWidth: boxW, boxHeight: boxH } = dimensions;

  const boxColors: Record<string, { stroke: string; fill: string }> = {
    destinateur: { stroke: "#C55A11", fill: "#FCEFE5" },
    destinataire: { stroke: "#C55A11", fill: "#FCEFE5" },
    objet: { stroke: "#1F4E79", fill: "#E8F0F7" },
    sujet: { stroke: "#1F4E79", fill: "#E8F0F7" },
    adjuvant: { stroke: "#595959", fill: "#F2F2F2" },
    opposant: { stroke: "#595959", fill: "#F2F2F2" },
  };

  const boxesSvg = boxes
    .map((box) => {
      const color = boxColors[box.key];
      const x = box.cx - boxW / 2;
      const y = box.cy - boxH / 2;
      return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6" ry="6" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/><text x="${box.cx}" y="${box.cy - 6}" text-anchor="middle" font-family="Helvetica" font-size="10" fill="${color.stroke}" font-weight="bold">${escapeHtml(box.label)}</text><text x="${box.cx}" y="${box.cy + 14}" text-anchor="middle" font-family="Helvetica" font-size="11" fill="#1a1a1a" font-style="italic">${escapeHtml(box.value)}</text>`;
    })
    .join("");

  return `
<div class="actantial-diagram-pdf" style="text-align: center; margin: 1em 0;">
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="700" height="350">
    <line x1="${W / 2}" y1="${H - 80 - boxH / 2 - 5}" x2="${W / 2}" y2="${80 + boxH / 2 + 5}" stroke="#1F4E79" stroke-width="3"/>
    <polygon points="${W / 2 - 6},${80 + boxH / 2 + 10} ${W / 2 + 6},${80 + boxH / 2 + 10} ${W / 2},${80 + boxH / 2 + 2}" fill="#1F4E79"/>
    <text x="${W / 2 + 10}" y="${H / 2}" font-family="Helvetica" font-size="9" fill="#1F4E79" font-weight="bold">AXE DU DÉSIR</text>
    <line x1="${130 + boxW / 2 + 5}" y1="80" x2="${W - 130 - boxW / 2 - 5}" y2="80" stroke="#C55A11" stroke-width="2"/>
    <polygon points="${W - 130 - boxW / 2 - 3},75 ${W - 130 - boxW / 2 - 3},85 ${W - 130 - boxW / 2 + 5},80" fill="#C55A11"/>
    <text x="${W / 2}" y="35" text-anchor="middle" font-family="Helvetica" font-size="9" fill="#C55A11" font-weight="bold">AXE DE COMMUNICATION</text>
    <line x1="${130 + boxW / 2 + 5}" y1="${H - 80}" x2="${W / 2 - boxW / 2 - 5}" y2="${H - 80}" stroke="#595959" stroke-width="2"/>
    <polygon points="${W / 2 - boxW / 2 - 3},${H - 85} ${W / 2 - boxW / 2 - 3},${H - 75} ${W / 2 - boxW / 2 + 5},${H - 80}" fill="#595959"/>
    <line x1="${W - 130 - boxW / 2 - 5}" y1="${H - 80}" x2="${W / 2 + boxW / 2 + 5}" y2="${H - 80}" stroke="#595959" stroke-width="2" stroke-dasharray="4 3"/>
    <polygon points="${W / 2 + boxW / 2 + 3},${H - 85} ${W / 2 + boxW / 2 + 3},${H - 75} ${W / 2 + boxW / 2 - 5},${H - 80}" fill="#595959"/>
    ${boxesSvg}
</svg>
<p style="font-size: 0.8em; font-style: italic; color: #666; text-align: center;">
Schéma actantiel d'après A. J. Greimas (Sémantique structurale, 1966).
</p>
</div>`;
}

export function renderAnalysisHtmlReport(analysis: AnalysisReportData & { dateHuman: string }): string {
  const nodesHtml = analysis.nodes
    .map((n, i) => {
      let h = `<div class="node"><h3>Nœud ${i + 1} — ${escapeHtml(n.functionName || n.functionCode || "?")}</h3>`;
      if (n.functionCode) h += `<p><strong>Code :</strong> <code>${escapeHtml(n.functionCode)}</code></p>`;
      if (n.actants.length > 0) h += `<p><strong>Actants :</strong> ${escapeHtml(n.actants.join(", "))}</p>`;
      const modStr = Object.entries(n.modalities).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(" · ");
      h += `<p><strong>Modalités :</strong> ${escapeHtml(modStr)}</p>`;
      h += `<p><strong>Tension :</strong> ${n.tension.toFixed(2)} · <strong>Phase :</strong> ${escapeHtml(n.phase ?? "?")}</p>`;
      if (n.textExcerpt) h += `<blockquote>${escapeHtml(n.textExcerpt.slice(0, 300))}</blockquote>`;
      h += "</div>";
      return h;
    })
    .join("");

  let llmSection = "";
  if (analysis.mode === "llm" && (analysis.summary || analysis.genre || analysis.mainActants)) {
    llmSection = '<section class="llm-block"><h2>Synthèse de l\'analyse</h2>';
    if (analysis.summary) llmSection += `<p><strong>Résumé :</strong> ${escapeHtml(analysis.summary)}</p>`;
    if (analysis.genre) llmSection += `<p><strong>Genre :</strong> ${escapeHtml(analysis.genre)}</p>`;
    if (analysis.tradition) llmSection += `<p><strong>Tradition narrative :</strong> ${escapeHtml(analysis.tradition)}</p>`;
    if (analysis.thematicKeywords && analysis.thematicKeywords.length > 0) {
      llmSection += `<p><strong>Thématiques :</strong> ${escapeHtml(analysis.thematicKeywords.join(", "))}</p>`;
    }
    const actantsV1 = analysis.mainActants?.v1;
    if (actantsV1) {
      llmSection += "<h3>Schéma actantiel identifié</h3><table class=\"actant-table\">";
      const labels: [keyof MainActants, string][] = [
        ["protagoniste", "Sujet (protagoniste)"],
        ["objet", "Objet de la quête"],
        ["destinateur", "Destinateur"],
        ["destinataire", "Destinataire"],
        ["adjuvant", "Adjuvant"],
        ["opposant", "Opposant"],
      ];
      for (const [key, label] of labels) {
        const val = actantsV1[key];
        if (val) llmSection += `<tr><td><strong>${label}</strong></td><td>${escapeHtml(val)}</td></tr>`;
      }
      llmSection += "</table>";
      llmSection += renderActantialSvgOriginalPalette(actantsV1);
    }
    llmSection += "</section>";
  }

  const costSection =
    analysis.mode === "llm" && analysis.costUsd != null
      ? `<p class="cost-info"><em>Analyse via Claude — coût : ${analysis.costUsd.toFixed(4)} USD · ${(analysis.tokensTotal ?? 0).toLocaleString("fr-FR")} tokens</em></p>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Analyse NARR'IA — ${escapeHtml(analysis.title)}</title>
<style>
  body { font-family: Garamond, Georgia, serif; max-width: 780px; margin: 2em auto; padding: 0 1em; color: #1a1a1a; line-height: 1.6; text-align: justify; }
  .report-header { display: flex; align-items: center; gap: 1em; border-bottom: 3px solid #C55A11; padding-bottom: 0.5em; margin-bottom: 1em; }
  h1 { color: #1F4E79; margin: 0; text-align: left; }
  h2 { color: #1F4E79; border-bottom: 1px solid #C55A11; padding-bottom: 0.2em; margin-top: 1.5em; text-align: left; }
  h3 { color: #C55A11; text-align: left; }
  .meta { background: #F5F5F5; padding: 1em; border-left: 4px solid #1F4E79; }
  .llm-block { background: #FCEFE5; padding: 1em; border-left: 4px solid #C55A11; margin: 1em 0; }
  .node { background: #FAFAFA; padding: 1em; margin: 0.8em 0; border-left: 3px solid #C55A11; border-radius: 3px; }
  blockquote { border-left: 3px solid #C55A11; padding-left: 1em; color: #555; font-style: italic; text-align: justify; }
  code { background: #EEE; padding: 0.1em 0.4em; border-radius: 3px; }
  table.actant-table { width: 100%; border-collapse: collapse; margin: 0.8em 0; }
  table.actant-table td { padding: 0.4em 0.6em; border: 1px solid #DDD; }
  table.actant-table td:first-child { background: #F5F5F5; width: 35%; }
  .cost-info { font-size: 0.85em; color: #666; text-align: right; }
  footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #DDD; color: #777; font-size: 0.85em; text-align: center; }
</style></head><body>
<div class="report-header">
<h1>Analyse NARR'IA</h1>
</div>
<div class="meta">
  <p><strong>Œuvre :</strong> ${escapeHtml(analysis.title)}<br>
     <strong>Auteur :</strong> ${escapeHtml(analysis.author)}<br>
     <strong>Date d'analyse :</strong> ${escapeHtml(analysis.dateHuman)}<br>
     <strong>Mode :</strong> ${escapeHtml(analysis.mode)}</p>
</div>
${llmSection}
<section><h2>Graphe narratif (${analysis.nodes.length} nœuds)</h2>
${nodesHtml}
</section>
${costSection}
<footer>Généré par NARR'IA — Système de narratologie computationnelle.</footer>
</body></html>`;
}
```

- [ ] **Step 2: Créer la route d'export (HTML pour l'instant)**

```typescript
// web/app/api/analyze/[id]/export/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Analysis } from "@/lib/db/models/analysis";
import { renderAnalysisHtmlReport } from "@/lib/reports/analysis-html-report";

export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "rapport";
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "html";
  if (format !== "html" && format !== "pdf") {
    return NextResponse.json({ error: "Format non supporté (html ou pdf)." }, { status: 400 });
  }

  await connectDB();
  const doc = await Analysis.findOne({ _id: id, ownerId: session.user.id }).lean();
  if (!doc) {
    return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
  }

  const graph = doc.graph as { nodes: unknown[] };
  const html = renderAnalysisHtmlReport({
    title: doc.title,
    author: doc.author,
    mode: doc.mode,
    summary: doc.summary,
    genre: doc.genre,
    tradition: doc.tradition,
    mainActants: doc.mainActants ?? undefined,
    thematicKeywords: doc.thematicKeywords,
    nodes: (graph.nodes as never[]).map((n: Record<string, unknown>) => ({
      nodeId: n.nodeId,
      functionCode: n.functionCode,
      functionName: n.functionName,
      functionFamily: n.functionFamily,
      actants: n.actants,
      modalities: n.modalities,
      tension: n.tension,
      phase: n.phase,
      textExcerpt: n.textExcerpt,
    })) as never,
    costUsd: doc.costUsd,
    tokensTotal: doc.costTokens,
    dateHuman: new Date(doc.createdAt as Date).toLocaleString("fr-FR"),
  });

  const filename = `${slugify(doc.title)}_${doc._id}`;

  if (format === "html") {
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.html"`,
      },
    });
  }

  const { htmlToPdf } = await import("@/lib/reports/pdf");
  const pdf = await htmlToPdf(html);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Vérification manuelle**

Run: `cd web && npm run dev`
Après une analyse sur `/analyser`, appeler directement
`GET /api/analyze/<id>/export?format=html` (id visible dans la réponse réseau de
`/api/analyze`) : le fichier téléchargé doit visuellement correspondre à
`~/Downloads/Roméo_et_Juliette_synopsis_romancé_a_20260630_164315_509162.html` (mêmes
sections, même palette).

- [ ] **Step 4: Commit**

```bash
cd web && git add lib/reports/analysis-html-report.ts "app/api/analyze/[id]/export/route.ts"
git commit -m "feat(rapport): export HTML autoportant fidèle à l'original"
```

---

### Task 10: Export PDF (puppeteer-core + chromium serverless)

**Files:**
- Create: `web/lib/reports/pdf.ts`
- Modify: `web/package.json`
- Modify: `web/components/analyse/analysis-report.tsx`
- Modify: `web/app/(app)/analyser/page.tsx`

- [ ] **Step 1: Installer les dépendances PDF**

Run: `cd web && npm install puppeteer-core @sparticuz/chromium`
Expected: 2 packages ajoutés à `dependencies`.

- [ ] **Step 2: Implémenter la conversion HTML → PDF**

```typescript
// web/lib/reports/pdf.ts
/**
 * Conversion HTML → PDF via Chromium headless serverless (pattern standard
 * Vercel : `@sparticuz/chromium` fournit un binaire Chromium compatible AWS
 * Lambda/Vercel, piloté par `puppeteer-core`).
 */
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export async function htmlToPdf(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 3: Ajouter les boutons d'export sur le rapport**

```tsx
// web/components/analyse/analysis-report.tsx
// Ajouter l'import :
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Étendre AnalysisReportData avec un id optionnel (présent une fois l'analyse sauvegardée) :
export interface AnalysisReportData {
  id?: string;
  // ...(champs existants inchangés)
}

// Dans le JSX de AnalysisReport, juste avant la fermeture du <div className="space-y-6">
// final (après le bloc de coût), ajouter :
      {data.id && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/analyze/${data.id}/export?format=html`} download>
              <Download className="h-4 w-4" /> Télécharger HTML
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/analyze/${data.id}/export?format=pdf`} download>
              <Download className="h-4 w-4" /> Télécharger PDF
            </a>
          </Button>
        </div>
      )}
```

Si `Button` ne supporte pas encore la prop `asChild` (vérifier `web/components/ui/button.tsx`),
remplacer ce bloc par de simples liens stylés :

```tsx
      {data.id && (
        <div className="flex justify-end gap-2">
          <a
            href={`/api/analyze/${data.id}/export?format=html`}
            download
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-surface-2"
          >
            <Download className="h-4 w-4" /> Télécharger HTML
          </a>
          <a
            href={`/api/analyze/${data.id}/export?format=pdf`}
            download
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-surface-2"
          >
            <Download className="h-4 w-4" /> Télécharger PDF
          </a>
        </div>
      )}
```

- [ ] **Step 4: Transmettre `id` depuis /api/analyze vers le state React**

```typescript
// web/app/(app)/analyser/page.tsx
// L'API /api/analyze renvoie déjà { id, ... } (Task 6) ; AnalyzeResult étend déjà
// AnalysisReportData (Task 8) donc `result.id` est disponible sans changement
// supplémentaire — vérifier simplement que `id: string` est bien dans l'interface
// AnalyzeResult si ce n'est pas déjà le cas via l'extends.
```

- [ ] **Step 5: Vérification manuelle**

Run: `cd web && npm run dev`
Sur `/analyser`, après une analyse, cliquer "Télécharger PDF" : un fichier `.pdf` doit se
télécharger et s'ouvrir correctement, avec le même contenu que l'export HTML.
Sur Vercel (déploiement), vérifier que `@sparticuz/chromium` reste sous la limite de
taille de fonction serverless (250 Mo décompressé) — si le build échoue pour excès de
taille, se référer à la doc `@sparticuz/chromium` pour la variante `-min` avec
téléchargement du binaire à froid.

- [ ] **Step 6: Commit**

```bash
cd web && git add lib/reports/pdf.ts package.json package-lock.json components/analyse/analysis-report.tsx
git commit -m "feat(rapport): export PDF serverless + boutons de téléchargement"
```

---

## Self-Review Notes

- **Couverture de la spec** : upload multi-format (Task 1-2), extraction LLM avec prompts
  fidèles + restriction culturelle + chunking (Task 3-5), modèle de données + route
  branchée en mode LLM (Task 6), schéma actantiel SVG (Task 7), rapport complet à l'écran
  (Task 8), export HTML fidèle (Task 9), export PDF (Task 10) — toutes les sections de la
  spec `2026-07-01-analyse-rapport-enrichi-design.md` sont couvertes.
- **Décision assumée hors spec** : les tests de `file-extractor.ts` pour les formats
  binaires (docx/pdf/odt/epub) sont vérifiés manuellement plutôt que par fixtures
  automatisées (fabriquer des binaires de test valides serait fragile et peu lisible) —
  documenté explicitement au Task 1 Step 6, pas un oubli.
- **Cohérence des types** : `LlmAnalysis`/`LlmNode` (Task 3) → consommés tels quels par
  `chunker.ts` (Task 4) et `llm-extractor.ts` (Task 5) → mappés vers `NarrativeNode`
  (`camelCase`, Task 5) → consommés par `AnalysisReportData`/`AnalysisReportNode`
  (Task 8) → réutilisés à l'identique par `analysis-html-report.ts` (Task 9). `MainActants`
  (Task 7) est le même type partout où un schéma actantiel est affiché ou exporté.
- **Hors scope confirmé** : comparaison (`/comparer`) — Phase 2, non traitée ici.

---

## Execution Handoff

Plan complet et sauvegardé dans `docs/superpowers/plans/2026-07-01-analyse-rapport-enrichi.md`.
