import type { NextConfig } from "next";

// Fichiers du binaire Chromium embarqué par @sparticuz/chromium (bin/*.br). Ils ne sont pas
// du JS : le file-tracing de Next ne les détecte pas tout seul, il faut les inclure
// explicitement dans les fonctions qui génèrent le PDF, sinon `executablePath()` échoue en prod
// (« The input directory .../@sparticuz/chromium/bin does not exist »).
const CHROMIUM_BIN = "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**/*";

const nextConfig: NextConfig = {
  // @sparticuz/chromium embarque un binaire : il ne doit PAS être bundlé (sinon son code JS est
  // relocalisé et ne retrouve plus son dossier bin). puppeteer-core le pilote.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Force l'inclusion du binaire Chromium dans les seules routes d'export PDF.
  outputFileTracingIncludes: {
    "/api/analyze/*/export": [CHROMIUM_BIN],
    "/api/compare/*/export": [CHROMIUM_BIN],
  },
};

export default nextConfig;
