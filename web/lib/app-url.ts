/**
 * Domaine public canonique du site — utilisé pour les métadonnées SEO
 * (metadataBase, robots.txt, sitemap.xml), indépendamment de l'environnement
 * de déploiement : Google doit toujours voir narria.tech, jamais l'URL Vercel.
 */
export const SITE_URL = "https://narria.tech";

/**
 * URL de base publique de l'application, pour construire des liens absolus (e-mails, etc.).
 * Priorité : NEXTAUTH_URL / AUTH_URL (déjà configurés pour Auth.js), puis VERCEL_URL,
 * enfin localhost en dernier recours.
 */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
