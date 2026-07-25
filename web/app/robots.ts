import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/app-url";

/**
 * robots.txt — ouvre les pages marketing au crawl et écarte les routes
 * applicatives (authentifiées, sans valeur pour la recherche).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/accueil",
        "/chat",
        "/analyser",
        "/comparer",
        "/historique",
        "/repertoire",
        "/projets",
        "/profil",
        "/notifications",
        "/configuration",
        "/admin",
        "/otp",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
