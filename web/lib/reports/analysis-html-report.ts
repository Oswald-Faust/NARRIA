/**
 * Rendu HTML autoportant d'un rapport d'analyse — port fidèle de
 * `narria/app.py::_render_analysis_html` + `_render_actantial_svg`. Palette et
 * structure identiques à l'original : ne pas recolorer, cet export doit rester
 * fidèle pixel-près à l'ancien rapport NARR'IA.
 */
import { getActantialLayout, type MainActants } from "./actantial-geometry";
import type { AnalysisReportData } from "@/components/analyse/analysis-report";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderActantialSvgOriginalPalette(actants: MainActants): string {
  const { dimensions, boxes } = getActantialLayout(actants);
  const { width: W, height: H, boxWidth: boxW, boxHeight: boxH } = dimensions;

  const boxColors: Record<string, { stroke: string; fill: string }> = {
    destinateur: { stroke: "#C55A11", fill: "#FCEFE5" },
    destinataire: { stroke: "#C55A11", fill: "#FCEFE5" },
    objet: { stroke: "#1F4E79", fill: "#E8F0F7" },
    sujet: { stroke: "#1F4E79", fill: "#E8F0F7" },
    adjuvant: { stroke: "#595959", fill: "#F2F2F2" },
    opposant: { stroke: "#595959", fill: "#F2F2F2" },
  };

  const boxesSvg = boxes
    .map((box) => {
      const color = boxColors[box.key];
      const x = box.cx - boxW / 2;
      const y = box.cy - boxH / 2;
      return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6" ry="6" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/><text x="${box.cx}" y="${box.cy - 6}" text-anchor="middle" font-family="Helvetica" font-size="10" fill="${color.stroke}" font-weight="bold">${escapeHtml(box.label)}</text><text x="${box.cx}" y="${box.cy + 14}" text-anchor="middle" font-family="Helvetica" font-size="11" fill="#1a1a1a" font-style="italic">${escapeHtml(box.value)}</text>`;
    })
    .join("");

  return `
<div class="actantial-diagram-pdf" style="text-align: center; margin: 1em 0;">
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="700" height="350">
    <line x1="${W / 2}" y1="${H - 80 - boxH / 2 - 5}" x2="${W / 2}" y2="${80 + boxH / 2 + 5}" stroke="#1F4E79" stroke-width="3"/>
    <polygon points="${W / 2 - 6},${80 + boxH / 2 + 10} ${W / 2 + 6},${80 + boxH / 2 + 10} ${W / 2},${80 + boxH / 2 + 2}" fill="#1F4E79"/>
    <text x="${W / 2 + 10}" y="${H / 2}" font-family="Helvetica" font-size="9" fill="#1F4E79" font-weight="bold">AXE DU DÉSIR</text>
    <line x1="${130 + boxW / 2 + 5}" y1="80" x2="${W - 130 - boxW / 2 - 5}" y2="80" stroke="#C55A11" stroke-width="2"/>
    <polygon points="${W - 130 - boxW / 2 - 3},75 ${W - 130 - boxW / 2 - 3},85 ${W - 130 - boxW / 2 + 5},80" fill="#C55A11"/>
    <text x="${W / 2}" y="35" text-anchor="middle" font-family="Helvetica" font-size="9" fill="#C55A11" font-weight="bold">AXE DE COMMUNICATION</text>
    <line x1="${130 + boxW / 2 + 5}" y1="${H - 80}" x2="${W / 2 - boxW / 2 - 5}" y2="${H - 80}" stroke="#595959" stroke-width="2"/>
    <polygon points="${W / 2 - boxW / 2 - 3},${H - 85} ${W / 2 - boxW / 2 - 3},${H - 75} ${W / 2 - boxW / 2 + 5},${H - 80}" fill="#595959"/>
    <line x1="${W - 130 - boxW / 2 - 5}" y1="${H - 80}" x2="${W / 2 + boxW / 2 + 5}" y2="${H - 80}" stroke="#595959" stroke-width="2" stroke-dasharray="4 3"/>
    <polygon points="${W / 2 + boxW / 2 + 3},${H - 85} ${W / 2 + boxW / 2 + 3},${H - 75} ${W / 2 + boxW / 2 - 5},${H - 80}" fill="#595959"/>
    ${boxesSvg}
</svg>
<p style="font-size: 0.8em; font-style: italic; color: #666; text-align: center;">
Schéma actantiel d'après A. J. Greimas (Sémantique structurale, 1966).
</p>
</div>`;
}

export function renderAnalysisHtmlReport(analysis: AnalysisReportData & { dateHuman: string }): string {
  const nodesHtml = analysis.nodes
    .map((n, i) => {
      let h = `<div class="node"><h3>Nœud ${i + 1} — ${escapeHtml(n.functionName || n.functionCode || "?")}</h3>`;
      if (n.functionCode) h += `<p><strong>Code :</strong> <code>${escapeHtml(n.functionCode)}</code></p>`;
      if (n.actants.length > 0) h += `<p><strong>Actants :</strong> ${escapeHtml(n.actants.join(", "))}</p>`;
      const modStr = Object.entries(n.modalities ?? {})
        .map(([k, v]) => `${k}=${v.toFixed(2)}`)
        .join(" · ");
      h += `<p><strong>Modalités :</strong> ${escapeHtml(modStr)}</p>`;
      h += `<p><strong>Tension :</strong> ${n.tension.toFixed(2)} · <strong>Phase :</strong> ${escapeHtml(n.phase ?? "?")}</p>`;
      if (n.textExcerpt) h += `<blockquote>${escapeHtml(n.textExcerpt.slice(0, 300))}</blockquote>`;
      h += "</div>";
      return h;
    })
    .join("");

  let llmSection = "";
  if (analysis.mode === "llm" && (analysis.summary || analysis.genre || analysis.mainActants)) {
    llmSection = "<section class=\"llm-block\"><h2>Synthèse de l'analyse</h2>";
    if (analysis.summary) llmSection += `<p><strong>Résumé :</strong> ${escapeHtml(analysis.summary)}</p>`;
    if (analysis.genre) llmSection += `<p><strong>Genre :</strong> ${escapeHtml(analysis.genre)}</p>`;
    if (analysis.tradition) llmSection += `<p><strong>Tradition narrative :</strong> ${escapeHtml(analysis.tradition)}</p>`;
    if (analysis.thematicKeywords && analysis.thematicKeywords.length > 0) {
      llmSection += `<p><strong>Thématiques :</strong> ${escapeHtml(analysis.thematicKeywords.join(", "))}</p>`;
    }
    const actantsV1 = analysis.mainActants?.v1;
    if (actantsV1) {
      llmSection += "<h3>Schéma actantiel identifié</h3><table class=\"actant-table\">";
      const labels: [keyof MainActants, string][] = [
        ["protagoniste", "Sujet (protagoniste)"],
        ["objet", "Objet de la quête"],
        ["destinateur", "Destinateur"],
        ["destinataire", "Destinataire"],
        ["adjuvant", "Adjuvant"],
        ["opposant", "Opposant"],
      ];
      for (const [key, label] of labels) {
        const val = actantsV1[key];
        if (val) llmSection += `<tr><td><strong>${label}</strong></td><td>${escapeHtml(val)}</td></tr>`;
      }
      llmSection += "</table>";
      llmSection += renderActantialSvgOriginalPalette(actantsV1);
    }
    llmSection += "</section>";
  }

  const costSection =
    analysis.mode === "llm" && analysis.costUsd != null
      ? `<p class="cost-info"><em>Analyse via Claude — coût : ${analysis.costUsd.toFixed(4)} USD · ${(analysis.tokensTotal ?? 0).toLocaleString("fr-FR")} tokens</em></p>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Analyse NARR'IA — ${escapeHtml(analysis.title)}</title>
<style>
  body { font-family: Garamond, Georgia, serif; max-width: 780px; margin: 2em auto; padding: 0 1em; color: #1a1a1a; line-height: 1.6; text-align: justify; }
  .report-header { display: flex; align-items: center; gap: 1em; border-bottom: 3px solid #C55A11; padding-bottom: 0.5em; margin-bottom: 1em; }
  h1 { color: #1F4E79; margin: 0; text-align: left; }
  h2 { color: #1F4E79; border-bottom: 1px solid #C55A11; padding-bottom: 0.2em; margin-top: 1.5em; text-align: left; }
  h3 { color: #C55A11; text-align: left; }
  .meta { background: #F5F5F5; padding: 1em; border-left: 4px solid #1F4E79; }
  .llm-block { background: #FCEFE5; padding: 1em; border-left: 4px solid #C55A11; margin: 1em 0; }
  .node { background: #FAFAFA; padding: 1em; margin: 0.8em 0; border-left: 3px solid #C55A11; border-radius: 3px; }
  blockquote { border-left: 3px solid #C55A11; padding-left: 1em; color: #555; font-style: italic; text-align: justify; }
  code { background: #EEE; padding: 0.1em 0.4em; border-radius: 3px; }
  table.actant-table { width: 100%; border-collapse: collapse; margin: 0.8em 0; }
  table.actant-table td { padding: 0.4em 0.6em; border: 1px solid #DDD; }
  table.actant-table td:first-child { background: #F5F5F5; width: 35%; }
  .cost-info { font-size: 0.85em; color: #666; text-align: right; }
  footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #DDD; color: #777; font-size: 0.85em; text-align: center; }
</style></head><body>
<div class="report-header">
<h1>Analyse NARR'IA</h1>
</div>
<div class="meta">
  <p><strong>Œuvre :</strong> ${escapeHtml(analysis.title)}<br>
     <strong>Auteur :</strong> ${escapeHtml(analysis.author)}<br>
     <strong>Date d'analyse :</strong> ${escapeHtml(analysis.dateHuman)}<br>
     <strong>Mode :</strong> ${escapeHtml(analysis.mode)}</p>
</div>
${llmSection}
<section><h2>Graphe narratif (${analysis.nodes.length} nœuds)</h2>
${nodesHtml}
</section>
${costSection}
<footer>Généré par NARR'IA — Système de narratologie computationnelle.</footer>
</body></html>`;
}
