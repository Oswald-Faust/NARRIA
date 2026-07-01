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
    // Le rapport est un HTML autoportant (styles inline, SVG inline, pas de
    // requêtes réseau externes) : "load" suffit. `setContent` de cette version
    // de puppeteer-core n'accepte pas "networkidle0"/"networkidle2" (réservés
    // à la navigation via `goto`).
    await page.setContent(html, { waitUntil: "load" });
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
