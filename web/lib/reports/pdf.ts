/**
 * Conversion HTML → PDF via Chromium headless.
 *
 * - En production serverless (Vercel/AWS Lambda) : `@sparticuz/chromium` fournit un binaire
 *   Chromium compatible, piloté par `puppeteer-core`.
 * - En local (macOS/Windows/Linux de dev) : ce binaire Linux x64 n'est pas exécutable
 *   (`spawn ENOEXEC`). On se rabat alors sur un Chrome/Chromium installé sur la machine.
 */
import { existsSync } from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_REGION,
);

/** Emplacements usuels d'un Chrome/Chromium installé localement, par plateforme. */
function findLocalChrome(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        ]
      : process.platform === "win32"
        ? [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const executablePath = findLocalChrome();
  if (!executablePath) {
    throw new Error(
      "Aucun Chrome/Chromium local trouvé pour générer le PDF. Installez Google Chrome, ou définissez PUPPETEER_EXECUTABLE_PATH.",
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Timeout explicite cohérent avec `maxDuration` de la route d'export : on veut échouer
    // proprement avant le hard-kill de la fonction serverless.
    page.setDefaultTimeout(45000);
    // Rapport autoportant (styles inline, SVG inline, aucune requête réseau externe) :
    // "load" suffit ("networkidle*" est réservé à la navigation via `goto`).
    await page.setContent(html, { waitUntil: "load", timeout: 45000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
      timeout: 45000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
