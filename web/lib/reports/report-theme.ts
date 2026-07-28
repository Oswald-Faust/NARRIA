/**
 * Thème partagé des rapports exportés (HTML autoportant → aussi utilisé pour le PDF).
 *
 * Design CLAIR aux couleurs de la marque NARR'IA (violet #843b90 / rose #da3861),
 * reprenant la structure et le contenu des rapports affichés à l'écran, mais sur fond
 * clair pour rester imprimable et partageable. Autoportant : styles inline, aucune
 * ressource réseau externe.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const BRAND = {
  purple: "#843b90",
  pink: "#da3861",
  yellow: "#c67c1e",
  softPurple: "#c68cc4",
  softPink: "#fc92a4",
  ink: "#2a2233",
  muted: "#6c6c6c",
  border: "#ece2f0",
  surface: "#ffffff",
  surface2: "#f7f2f9",
  page: "#f4eff7",
} as const;

/** Couleur du badge de risque SRJ, cohérente avec les tons de l'app. */
export function srjBadgeColor(level: string): { bg: string; fg: string } {
  switch (level) {
    case "Critique":
      return { bg: "#fde2e4", fg: "#b3243b" };
    case "Élevé":
      return { bg: "#ffe4ea", fg: "#c22a51" };
    case "Modéré":
      return { bg: "#f0e8f4", fg: "#843b90" };
    default: // Faible
      return { bg: "#e3f4ea", fg: "#1f7a4d" };
  }
}

/** Badge « pill » réutilisable dans les rapports. */
export function badge(text: string, tone: "purple" | "pink" | "yellow" | "neutral" = "purple"): string {
  return `<span class="badge badge--${tone}">${escapeHtml(text)}</span>`;
}

/** Barre de tension (sparkline) en dégradé violet→rose. */
export function tensionBars(profile: number[]): string {
  if (!profile || profile.length === 0) return "";
  const maxT = Math.max(...profile, 0);
  const bars = profile
    .map((t) => {
      const h = maxT > 0 ? Math.max(2, Math.round((t / maxT) * 46)) : 2;
      return `<span class="tbar" style="height:${h}px"></span>`;
    })
    .join("");
  return `<div class="tension">${bars}</div>`;
}

const BASE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
/* Écart fonction/contenu : la fonction narrative coïncide sans que les épisodes
   racontent la même chose — procédé commun, non emprunt (point 5 des bêta-tests). */
.trope {
  margin-top: 6px;
  padding: 4px 6px;
  border: 1px solid ${BRAND.yellow}66;
  border-left: 3px solid ${BRAND.yellow};
  border-radius: 4px;
  background: ${BRAND.yellow}18;
  color: #8a5a10;
  font-size: 10px;
  line-height: 1.35;
}
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: ${BRAND.ink};
  background: ${BRAND.page};
  line-height: 1.6;
  margin: 0;
  padding: 32px 16px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.report {
  max-width: 900px;
  margin: 0 auto;
  background: ${BRAND.surface};
  border: 1px solid ${BRAND.border};
  border-radius: 20px;
  padding: 40px 44px;
  box-shadow: 0 12px 40px rgba(132, 59, 144, 0.08);
}
.report-head { margin-bottom: 28px; }
.report-head h1 {
  font-size: 1.9rem;
  margin: 0 0 6px;
  color: ${BRAND.purple};
  letter-spacing: -0.01em;
}
.report-head .rule {
  height: 4px; width: 96px; border-radius: 999px;
  background: linear-gradient(90deg, ${BRAND.purple}, ${BRAND.pink});
  margin: 10px 0 14px;
}
.report-head .sub { color: ${BRAND.muted}; font-size: 0.9rem; margin: 2px 0; }
h2.section {
  font-size: 1.15rem;
  color: ${BRAND.purple};
  border-bottom: 2px solid ${BRAND.border};
  padding-bottom: 8px;
  margin: 34px 0 16px;
}
h3 { font-size: 1rem; margin: 0 0 8px; color: ${BRAND.ink}; }
p { margin: 0.4em 0; }
strong { color: ${BRAND.ink}; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card {
  background: ${BRAND.surface2};
  border: 1px solid ${BRAND.border};
  border-radius: 14px;
  padding: 16px 18px;
}
.card--ref { border-left: 4px solid ${BRAND.purple}; }
.card--cand { border-left: 4px solid ${BRAND.pink}; }
.eyebrow { font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.muted}; margin-bottom: 6px; }
.title-strong { font-weight: 700; font-size: 1.02rem; color: ${BRAND.ink}; }
.author { font-style: italic; color: ${BRAND.muted}; margin: 2px 0 8px; }
code {
  background: #fff;
  border: 1px solid ${BRAND.border};
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.85em;
  font-weight: 600;
  color: ${BRAND.purple};
}
.badge {
  display: inline-block;
  padding: 3px 11px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.5;
}
.badge--purple { background: #efe4f2; color: ${BRAND.purple}; }
.badge--pink { background: #ffe3ea; color: ${BRAND.pink}; }
.badge--yellow { background: #fbeecf; color: ${BRAND.yellow}; }
.badge--neutral { background: #eee9f0; color: ${BRAND.muted}; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.tension { display: flex; align-items: flex-end; gap: 3px; height: 48px; margin-top: 12px; }
.tbar { width: 10px; border-radius: 3px 3px 0 0; background: linear-gradient(180deg, ${BRAND.pink}, ${BRAND.softPurple}); }
.scores { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.score {
  background: ${BRAND.surface2};
  border: 1px solid ${BRAND.border};
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
}
.score--hl { border: 2px solid ${BRAND.pink}; background: #fff4f7; }
.score .lbl { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: ${BRAND.muted}; }
.score .val { font-size: 1.7rem; font-weight: 800; color: ${BRAND.purple}; margin: 4px 0; }
.score--hl .val { color: ${BRAND.pink}; }
.score .cap { font-size: 0.72rem; color: ${BRAND.muted}; }
.callout {
  border: 1px solid ${BRAND.border};
  border-left: 4px solid ${BRAND.purple};
  border-radius: 12px;
  padding: 16px 18px;
  background: ${BRAND.surface2};
}
.callout--alert { border-left-color: ${BRAND.pink}; background: #fff4f7; }
.callout--warn { border: 1px solid #f2dfc2; border-left: 4px solid ${BRAND.yellow}; background: #fdf6e9; border-radius: 12px; padding: 16px 18px; }
.callout--warn h3 { color: #9a6212; }
table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 0.9rem; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden; }
thead th { background: #f0e7f3; color: ${BRAND.purple}; text-align: left; font-weight: 700; padding: 10px 14px; font-size: 0.82rem; }
td { padding: 9px 14px; border-top: 1px solid ${BRAND.border}; }
ul { margin: 6px 0; padding-left: 20px; }
li { margin: 3px 0; }
.node {
  background: ${BRAND.surface2};
  border: 1px solid ${BRAND.border};
  border-radius: 12px;
  padding: 12px 14px;
  margin: 10px 0;
}
.node .node-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 4px; }
.node .node-id { font-weight: 700; color: ${BRAND.purple}; }
.node .meta-line { font-size: 0.8rem; color: ${BRAND.muted}; margin: 2px 0; }
.node blockquote { border-left: 3px solid ${BRAND.softPink}; margin: 6px 0 0; padding: 2px 0 2px 12px; color: ${BRAND.muted}; font-style: italic; font-size: 0.85rem; }
.tension-inline { display: inline-block; height: 7px; width: 120px; border-radius: 999px; background: ${BRAND.border}; overflow: hidden; vertical-align: middle; }
.tension-inline > span { display: block; height: 100%; background: linear-gradient(90deg, ${BRAND.purple}, ${BRAND.pink}); }
.cost { text-align: right; font-size: 0.78rem; font-style: italic; color: ${BRAND.muted}; margin-top: 10px; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid ${BRAND.border}; text-align: center; color: ${BRAND.muted}; font-size: 0.8rem; }
@media print {
  body { background: #fff; padding: 0; }
  .report { box-shadow: none; border: none; border-radius: 0; padding: 12px 8px; }
}
`;

/** Enveloppe HTML complète et autoportante d'un rapport. */
export function htmlShell(title: string, innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<main class="report">
${innerHtml}
<div class="footer">NARR'IA · narria.tech · Narratologie computationnelle</div>
</main>
</body>
</html>`;
}
