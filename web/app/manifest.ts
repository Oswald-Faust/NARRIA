import type { MetadataRoute } from "next";

/**
 * Manifeste PWA — donne aussi aux moteurs de recherche et à Android des
 * icônes de marque carrées explicites (Google privilégie les favicons carrés).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NARR'IA — Narratologie computationnelle",
    short_name: "NARR'IA",
    description:
      "Détectez, quantifiez et qualifiez le vol d'intrigue : NARR'IA analyse la structure narrative profonde de vos œuvres.",
    start_url: "/",
    display: "standalone",
    background_color: "#14101f",
    theme_color: "#843b90",
    lang: "fr",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
