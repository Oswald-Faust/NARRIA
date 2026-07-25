import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/app-url";

/** Pages publiques indexables (landing + déclinaisons produit + inscription). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/produit/etudiants`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/produit/recherche`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/produit/fun`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/register`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
