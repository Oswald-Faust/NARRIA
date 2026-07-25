/**
 * Rendu HTML autoportant d'un rapport d'analyse — design clair aux couleurs de la marque
 * NARR'IA, aligné sur le rapport affiché à l'écran (`components/analyse/analysis-report.tsx`).
 * Sert aussi de source au PDF.
 */
import { getActantialLayout, type MainActants } from "./actantial-geometry";
import type { AnalysisReportData } from "@/components/analyse/analysis-report";
import { BRAND, badge, escapeHtml, htmlShell } from "./report-theme";

function renderActantialSvg(actants: MainActants): string {
  const { dimensions, boxes } = getActantialLayout(actants);
  const { width: W, height: H, boxWidth: boxW, boxHeight: boxH } = dimensions;

  const boxColors: Record<string, { stroke: string; fill: string }> = {
    destinateur: { stroke: BRAND.pink, fill: "#ffeef2" },
    destinataire: { stroke: BRAND.pink, fill: "#ffeef2" },
    objet: { stroke: BRAND.purple, fill: "#f3e9f5" },
    sujet: { stroke: BRAND.purple, fill: "#f3e9f5" },
    adjuvant: { stroke: "#7a7a7a", fill: "#f2f2f2" },
    opposant: { stroke: "#7a7a7a", fill: "#f2f2f2" },
  };

  const boxesSvg = boxes
    .map((box) => {
      const color = boxColors[box.key];
      const x = box.cx - boxW / 2;
      const y = box.cy - boxH / 2;
      return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8" ry="8" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/><text x="${box.cx}" y="${box.cy - 6}" text-anchor="middle" font-family="Helvetica" font-size="10" fill="${color.stroke}" font-weight="bold">${escapeHtml(box.label)}</text><text x="${box.cx}" y="${box.cy + 14}" text-anchor="middle" font-family="Helvetica" font-size="11" fill="#2a2233" font-style="italic">${escapeHtml(box.value)}</text>`;
    })
    .join("");

  return `
<div style="text-align:center;margin:14px 0">
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="700" height="350" style="max-width:100%">
    <line x1="${W / 2}" y1="${H - 80 - boxH / 2 - 5}" x2="${W / 2}" y2="${80 + boxH / 2 + 5}" stroke="${BRAND.purple}" stroke-width="3"/>
    <polygon points="${W / 2 - 6},${80 + boxH / 2 + 10} ${W / 2 + 6},${80 + boxH / 2 + 10} ${W / 2},${80 + boxH / 2 + 2}" fill="${BRAND.purple}"/>
    <text x="${W / 2 + 10}" y="${H / 2}" font-family="Helvetica" font-size="9" fill="${BRAND.purple}" font-weight="bold">AXE DU DÉSIR</text>
    <line x1="${130 + boxW / 2 + 5}" y1="80" x2="${W / 2 - boxW / 2 - 5}" y2="80" stroke="${BRAND.pink}" stroke-width="2"/>
    <polygon points="${W / 2 - boxW / 2 - 3},75 ${W / 2 - boxW / 2 - 3},85 ${W / 2 - boxW / 2 + 5},80" fill="${BRAND.pink}"/>
    <line x1="${W / 2 + boxW / 2 + 5}" y1="80" x2="${W - 130 - boxW / 2 - 5}" y2="80" stroke="${BRAND.pink}" stroke-width="2"/>
    <polygon points="${W - 130 - boxW / 2 - 3},75 ${W - 130 - boxW / 2 - 3},85 ${W - 130 - boxW / 2 + 5},80" fill="${BRAND.pink}"/>
    <text x="${W / 2}" y="35" text-anchor="middle" font-family="Helvetica" font-size="9" fill="${BRAND.pink}" font-weight="bold">AXE DE COMMUNICATION</text>
    <line x1="${130 + boxW / 2 + 5}" y1="${H - 80}" x2="${W / 2 - boxW / 2 - 5}" y2="${H - 80}" stroke="#7a7a7a" stroke-width="2"/>
    <polygon points="${W / 2 - boxW / 2 - 3},${H - 85} ${W / 2 - boxW / 2 - 3},${H - 75} ${W / 2 - boxW / 2 + 5},${H - 80}" fill="#7a7a7a"/>
    <line x1="${W - 130 - boxW / 2 - 5}" y1="${H - 80}" x2="${W / 2 + boxW / 2 + 5}" y2="${H - 80}" stroke="#7a7a7a" stroke-width="2" stroke-dasharray="4 3"/>
    <polygon points="${W / 2 + boxW / 2 + 3},${H - 85} ${W / 2 + boxW / 2 + 3},${H - 75} ${W / 2 + boxW / 2 - 5},${H - 80}" fill="#7a7a7a"/>
    ${boxesSvg}
</svg>
<p style="font-size:0.78rem;font-style:italic;color:${BRAND.muted}">Schéma actantiel d'après A. J. Greimas (Sémantique structurale, 1966).</p>
</div>`;
}

export function renderAnalysisHtmlReport(analysis: AnalysisReportData & { dateHuman: string }): string {
  const functionChips = analysis.nodes
    .map((n) => n.functionCode)
    .filter((c): c is string => !!c);

  const nodesHtml = analysis.nodes
    .map((n, i) => {
      const parts: string[] = [];
      parts.push(
        `<div class="node-head"><span class="node-id">Nœud ${i + 1}${n.nodeId ? ` · ${escapeHtml(n.nodeId)}` : ""}</span>` +
          (n.functionCode ? badge(n.functionCode, n.functionCode.startsWith("FN") ? "yellow" : "pink") : "") +
          (n.functionName ? `<span>${escapeHtml(n.functionName)}</span>` : "") +
          (n.phase ? badge(n.phase, "neutral") : "") +
          `</div>`,
      );
      if (n.functionFamily) parts.push(`<p class="meta-line">${escapeHtml(n.functionFamily)}</p>`);
      if (n.actants.length > 0) parts.push(`<p class="meta-line">Actants : ${escapeHtml(n.actants.join(", "))}</p>`);
      const m = n.modalities ?? { vouloir: 0, devoir: 0, pouvoir: 0, savoir: 0 };
      parts.push(
        `<p class="meta-line">Modalités : vouloir=${m.vouloir.toFixed(2)} · devoir=${m.devoir.toFixed(2)} · pouvoir=${m.pouvoir.toFixed(2)} · savoir=${m.savoir.toFixed(2)}</p>`,
      );
      parts.push(
        `<p class="meta-line"><span class="tension-inline"><span style="width:${Math.round((n.tension ?? 0) * 100)}%"></span></span> tension ${(n.tension ?? 0).toFixed(2)}</p>`,
      );
      if (n.textExcerpt) parts.push(`<blockquote>« ${escapeHtml(n.textExcerpt.slice(0, 400))} »</blockquote>`);
      return `<div class="node">${parts.join("")}</div>`;
    })
    .join("");

  let synthesis = "";
  if (analysis.summary || analysis.genre || analysis.mainActants?.v1) {
    const rows: string[] = [];
    if (analysis.summary) rows.push(`<p>${escapeHtml(analysis.summary)}</p>`);
    if (analysis.genre) rows.push(`<p><strong>Genre :</strong> ${escapeHtml(analysis.genre)}</p>`);
    if (analysis.tradition) rows.push(`<p><strong>Tradition narrative :</strong> ${escapeHtml(analysis.tradition)}</p>`);
    if (analysis.thematicKeywords && analysis.thematicKeywords.length > 0) {
      rows.push(`<div class="chips">${analysis.thematicKeywords.map((k) => badge(k, "pink")).join("")}</div>`);
    }
    const actantsV1 = analysis.mainActants?.v1;
    if (actantsV1) {
      const labels: [keyof MainActants, string][] = [
        ["protagoniste", "Sujet (protagoniste)"],
        ["objet", "Objet de la quête"],
        ["destinateur", "Destinateur"],
        ["destinataire", "Destinataire"],
        ["adjuvant", "Adjuvant"],
        ["opposant", "Opposant"],
      ];
      const trs = labels
        .filter(([k]) => actantsV1[k])
        .map(([k, lbl]) => `<tr><td style="width:38%"><strong>${lbl}</strong></td><td>${escapeHtml(actantsV1[k])}</td></tr>`)
        .join("");
      if (trs) {
        rows.push(`<h3 style="margin-top:14px">Schéma actantiel identifié</h3><table><tbody>${trs}</tbody></table>`);
        rows.push(renderActantialSvg(actantsV1));
      }
    }
    synthesis = `<h2 class="section">Synthèse de l'analyse</h2><div class="callout callout--alert">${rows.join("")}</div>`;
  }

  const cost =
    analysis.mode === "llm" && analysis.costUsd != null
      ? `<p class="cost">Analyse via Claude — coût : ${analysis.costUsd.toFixed(4)} USD · ${(analysis.tokensTotal ?? 0).toLocaleString("fr-FR")} tokens</p>`
      : "";

  const inner = `
<div class="report-head">
  <h1>Rapport d'analyse narrative</h1>
  <div class="rule"></div>
  <p class="sub"><strong>${escapeHtml(analysis.title)}</strong> — ${escapeHtml(analysis.author)}</p>
  <p class="sub">Généré le ${escapeHtml(analysis.dateHuman)} · Mode : ${escapeHtml(analysis.mode)}</p>
</div>

${synthesis}

${
  functionChips.length > 0
    ? `<h2 class="section">Séquence de fonctions</h2><div class="chips">${functionChips.map((c) => badge(c, c.startsWith("FN") ? "yellow" : "pink")).join("")}</div>`
    : ""
}

<h2 class="section">Graphe narratif (${analysis.nodes.length} nœuds)</h2>
${nodesHtml || "<p><em>Aucun nœud narratif détecté.</em></p>"}
${cost}
`;

  return htmlShell(`Analyse NARR'IA — ${analysis.title}`, inner);
}
