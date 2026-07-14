/**
 * Rendu HTML autoportant du rapport de comparaison — design clair aux couleurs de la
 * marque NARR'IA, aligné sur le rapport affiché à l'écran (`components/comparer/
 * comparison-report.tsx`). Sert aussi de source au PDF.
 */
import { badge, escapeHtml, htmlShell, srjBadgeColor, tensionBars } from "./report-theme";

export interface ComparisonReportWork {
  title: string;
  author: string;
  graphId: string;
  nNodes: number;
  nEdges: number;
  tensionProfile: number[];
  mode: string;
  summary?: string;
  genre?: string;
  tradition?: string;
  thematicKeywords?: string[];
  mainActants?: {
    protagoniste?: string;
    objet?: string;
    destinateur?: string;
    destinataire?: string;
    adjuvant?: string;
    opposant?: string;
  } | null;
  costUsd?: number;
}

export interface ComparisonReportCorrespondence {
  refNode: string;
  refFunction: string;
  candNode: string;
  candFunction: string;
  similarity: number;
}

export interface ComparisonHtmlReportData {
  dateHuman: string;
  refWork: ComparisonReportWork;
  candWork: ComparisonReportWork;
  sns: number;
  snsNormalized: number;
  ss: number;
  st: number;
  srj: number;
  srjLevel: string;
  sIso: number;
  sGed: number;
  sFunc: number;
  sAct: number;
  sTens: number;
  detectedModality: string;
  verdict: string;
  correspondences: ComparisonReportCorrespondence[];
  warnings: string[];
}

const ACTANT_ROLES: Array<[keyof NonNullable<ComparisonReportWork["mainActants"]>, string]> = [
  ["protagoniste", "Protagoniste"],
  ["objet", "Objet"],
  ["destinateur", "Destinateur"],
  ["destinataire", "Destinataire"],
  ["adjuvant", "Adjuvant"],
  ["opposant", "Opposant"],
];

const SNS_COMPONENTS: Array<[string, string, keyof ComparisonHtmlReportData]> = [
  ["S_ISO", "Isomorphisme de sous-graphes narratifs (NARR'IA-VF2)", "sIso"],
  ["S_GED", "Distance d'édition de graphes narratifs (GED narrative)", "sGed"],
  ["S_FUNC", "Similarité des séquences de fonctions narratives (DTW)", "sFunc"],
  ["S_ACT", "Similarité des chaînes actantielles", "sAct"],
  ["S_TENS", "Corrélation des signatures tensives", "sTens"],
];

function workHeader(work: ComparisonReportWork, variant: "ref" | "cand", label: string): string {
  return `
  <div class="card card--${variant}">
    <p class="eyebrow">${escapeHtml(label)}</p>
    <p class="title-strong">${escapeHtml(work.title)}</p>
    <p class="author">${escapeHtml(work.author)}</p>
    <p>Graphe narratif : <code>${escapeHtml(work.graphId)}</code> — ${work.nNodes} nœuds, ${work.nEdges} transitions</p>
    ${tensionBars(work.tensionProfile)}
  </div>`;
}

function llmWorkBlock(work: ComparisonReportWork, variant: "ref" | "cand", label: string): string {
  if (work.mode !== "llm") {
    return `<div class="card card--${variant}"><p class="eyebrow">${escapeHtml(label)}</p><p><em>Analyse en mode local (heuristiques)</em></p></div>`;
  }
  const rows: string[] = [];
  if (work.summary) rows.push(`<p><strong>Résumé :</strong> ${escapeHtml(work.summary)}</p>`);
  if (work.genre) rows.push(`<p><strong>Genre :</strong> ${escapeHtml(work.genre)}</p>`);
  if (work.tradition) rows.push(`<p><strong>Tradition :</strong> ${escapeHtml(work.tradition)}</p>`);
  if (work.thematicKeywords && work.thematicKeywords.length > 0) {
    rows.push(`<div class="chips">${work.thematicKeywords.map((k) => badge(k, "pink")).join("")}</div>`);
  }
  const actants = work.mainActants ?? null;
  if (actants) {
    const items = ACTANT_ROLES.filter(([k]) => actants[k]).map(
      ([k, lbl]) => `<li><strong>${lbl} :</strong> ${escapeHtml(actants[k] as string)}</li>`,
    );
    if (items.length > 0) rows.push(`<p><strong>Schéma actantiel :</strong></p><ul>${items.join("")}</ul>`);
  }
  if (typeof work.costUsd === "number") {
    rows.push(`<p class="cost">Analyse LLM : ${work.costUsd.toFixed(4)} USD consommés</p>`);
  }
  return `<div class="card card--${variant}"><p class="eyebrow">${escapeHtml(label)}</p>${rows.join("")}</div>`;
}

export function renderComparisonHtmlReport(data: ComparisonHtmlReportData): string {
  const { refWork, candWork } = data;
  const hasLlmMeta =
    !!(refWork.summary || refWork.genre || refWork.mainActants) ||
    !!(candWork.summary || candWork.genre || candWork.mainActants);
  const srj = srjBadgeColor(data.srjLevel);
  const highSim = data.sns > 0.5;

  const correspondencesRows =
    data.correspondences.length === 0
      ? '<tr><td colspan="4"><em>Aucune correspondance forte détectée.</em></td></tr>'
      : data.correspondences
          .slice(0, 15)
          .map(
            (c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><code>${escapeHtml(c.refNode || "—")}</code> (${escapeHtml(c.refFunction || "—")})</td>
          <td><code>${escapeHtml(c.candNode || "—")}</code> (${escapeHtml(c.candFunction || "—")})</td>
          <td>${((c.similarity ?? 0) * 100).toFixed(1)}%</td>
        </tr>`,
          )
          .join("");

  const warningsHtml =
    data.warnings && data.warnings.length > 0
      ? `<div class="callout callout--warn" style="margin-top:14px">
           <ul>${data.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
         </div>`
      : "";

  const inner = `
<div class="report-head">
  <h1>Rapport de comparaison</h1>
  <div class="rule"></div>
  <p class="sub"><strong>${escapeHtml(refWork.title)}</strong> vs <strong>${escapeHtml(candWork.title)}</strong></p>
  <p class="sub">Généré le ${escapeHtml(data.dateHuman)} · NARR'IA — Narratologie computationnelle du plagiat d'intrigue</p>
</div>

<h2 class="section">Œuvres comparées</h2>
<div class="grid-2">
  ${workHeader(refWork, "ref", "Œuvre de référence")}
  ${workHeader(candWork, "cand", "Œuvre candidate")}
</div>

${
  hasLlmMeta
    ? `<h2 class="section">Analyse sémantique (mode LLM)</h2>
<div class="grid-2">
  ${llmWorkBlock(refWork, "ref", "Œuvre de référence")}
  ${llmWorkBlock(candWork, "cand", "Œuvre candidate")}
</div>`
    : ""
}

<h2 class="section">Scores composites</h2>
<div class="scores">
  <div class="score score--hl"><div class="lbl">SNS</div><div class="val">${data.sns.toFixed(3)}</div><div class="cap">Similarité narrative</div></div>
  <div class="score"><div class="lbl">SNS_N</div><div class="val">${data.snsNormalized.toFixed(3)}</div><div class="cap">Normalisé / genre</div></div>
  <div class="score"><div class="lbl">SS</div><div class="val">${data.ss.toFixed(3)}</div><div class="cap">Spécificité</div></div>
  <div class="score"><div class="lbl">ST</div><div class="val">${data.st.toFixed(3)}</div><div class="cap">Transformation</div></div>
  <div class="score"><div class="lbl">SRJ</div><div class="val">${data.srj.toFixed(3)}</div><div class="cap"><span class="badge" style="background:${srj.bg};color:${srj.fg}">${escapeHtml(data.srjLevel)}</span></div></div>
</div>

<h2 class="section">Verdict interprétatif</h2>
<div class="callout ${highSim ? "callout--alert" : ""}">
  <p><strong>Modalité détectée :</strong> ${escapeHtml(data.detectedModality)}</p>
  <p>${escapeHtml(data.verdict)}</p>
</div>

<h2 class="section">Détail des composantes du SNS</h2>
<table>
  <thead><tr><th>Composante</th><th>Description</th><th>Score</th></tr></thead>
  <tbody>
    ${SNS_COMPONENTS.map(([code, desc, key]) => `<tr><td><strong>${code}</strong></td><td>${desc}</td><td>${(data[key] as number).toFixed(3)}</td></tr>`).join("")}
  </tbody>
</table>

<h2 class="section">Note méthodologique</h2>
<div class="callout">
  <h3>Sur la lecture des scores</h3>
  <p>Les indicateurs primaires de NARR'IA, sur lesquels l'interprétation doit principalement s'appuyer, sont le <strong>SNS</strong> (similarité narrative composite), le <strong>S_ISO</strong> (isomorphisme structural) et le <strong>S_TENS</strong> (signature tensive), ainsi que le <strong>verdict modal</strong>. Ces indicateurs reposent sur des algorithmes structurellement stables.</p>
  <p>Les sous-scores <strong>S_ACT</strong> (chaînes actantielles) et <strong>ST</strong> (transformations) relèvent d'algorithmes sensibles à la formulation des actants extraits par le LLM et aux métadonnées formelles fournies. Ils constituent des <em>indicateurs secondaires</em> en cours de calibration empirique. Une certaine variabilité de ces deux scores entre exécutions est attendue et ne remet pas en cause la fiabilité du verdict global.</p>
  <p>Pour toute analyse rigoureuse, il convient d'interpréter ces deux sous-scores avec prudence et de privilégier l'expertise humaine du narratologue pour qualifier la nature exacte des transformations entre œuvres.</p>
</div>

<h2 class="section">Correspondances structurales principales</h2>
<table>
  <thead><tr><th>#</th><th>Nœud de référence</th><th>Nœud candidat</th><th>Similarité</th></tr></thead>
  <tbody>${correspondencesRows}</tbody>
</table>

<h2 class="section">Limites et avertissements</h2>
<div class="callout callout--warn">
  <h3>À retenir impérativement</h3>
  <ul>
    <li>Les scores NARR'IA sont des <strong>estimations probabilistes</strong>, jamais des verdicts définitifs de plagiat.</li>
    <li>L'interprétation des résultats exige une <strong>expertise humaine</strong> (narratologue, juriste selon le contexte).</li>
    <li>Un SNS élevé peut refléter une <strong>convergence indépendante</strong> due à des conventions génériques communes, sans emprunt réel.</li>
    <li>Une accusation publique de plagiat <strong>ne peut en aucun cas</strong> se fonder sur ces seuls scores.</li>
    <li>Ce rapport ne constitue <strong>pas un avis juridique</strong>. Pour toute suite judiciaire, consulter un avocat spécialisé en propriété intellectuelle.</li>
  </ul>
</div>
${warningsHtml}
`;

  return htmlShell(`Rapport NARR'IA — ${refWork.title} vs ${candWork.title}`, inner);
}
