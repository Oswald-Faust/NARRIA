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

  const titleMatch = /<dc:title[^>]*>([^<]*)<\/dc:title>/.exec(opfXml);
  const authorMatch = /<dc:creator[^>]*>([^<]*)<\/dc:creator>/.exec(opfXml);

  const manifest = new Map<string, string>();
  const itemRe = /<item\b[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(opfXml))) {
    manifest.set(m[1], m[2]);
  }
  const itemReAlt = /<item\b[^>]*\bhref="([^"]+)"[^>]*\bid="([^"]+)"[^>]*\/?>/g;
  while ((m = itemReAlt.exec(opfXml))) {
    if (!manifest.has(m[2])) manifest.set(m[2], m[1]);
  }

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
