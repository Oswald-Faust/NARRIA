import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@sparticuz/chromium` embarque le binaire Chromium sous forme d'archive : il ne doit PAS
  // être bundlé par Next (sinon `executablePath()` ne le retrouve pas dans la fonction
  // serverless → le PDF échoue en prod alors qu'il marche en local). On l'exclut du bundling,
  // avec `puppeteer-core` qui le pilote.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
