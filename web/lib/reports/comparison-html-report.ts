/**
 * Rendu HTML autoportant du rapport de comparaison — port fidèle de
 * `narria/m5_reporting/reporter.py::generate_html` + `_render_llm_metadata`.
 * Palette et structure identiques à l'original (Georgia serif, #1F4E79/#C55A11/
 * #BDD7EE, badge SRJ coloré) : cet export doit rester fidèle pixel-près à
 * l'ancien rapport NARR'IA. Ne pas recolorer au thème sombre de l'app.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

const VERSION = "2.0.0";

const SRJ_COLORS: Record<string, string> = {
  Faible: "#107C10",
  Modéré: "#1F4E79",
  Élevé: "#C55A11",
  Critique: "#D13438",
};

const ACTANT_ROLES: Array<keyof NonNullable<ComparisonReportWork["mainActants"]>> = [
  "protagoniste",
  "objet",
  "destinateur",
  "destinataire",
  "adjuvant",
  "opposant",
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Port de `tension_bars` : sparkline en barres, hauteur tronquée (int Python). */
function tensionBars(profile: number[], color: string): string {
  if (!profile || profile.length === 0) return "";
  const maxT = Math.max(...profile);
  const bars = profile
    .map((t) => {
      const h = maxT > 0 ? Math.trunc((t / maxT) * 50) : 0;
      return `<div class="tbar" style="height: ${h}px; background: ${color};"></div>`;
    })
    .join("");
  return `<div class="tension-container">${bars}</div>`;
}

/** Port de `_render_llm_metadata` : un bloc par œuvre si au moins une est LLM. */
function renderLlmMetadata(refWork: ComparisonReportWork, candWork: ComparisonReportWork): string {
  const refIsLlm = refWork.mode === "llm";
  const candIsLlm = candWork.mode === "llm";
  if (!refIsLlm && !candIsLlm) return "";

  const workBlock = (work: ComparisonReportWork, label: string): string => {
    if (work.mode !== "llm") {
      return `<div class="work"><h4>${escapeHtml(label)}</h4><p><em>Analyse en mode local (heuristiques)</em></p></div>`;
    }
    let html = `<div class="work"><h4>${escapeHtml(label)}</h4>`;
    if (work.summary) html += `<p><strong>Résumé :</strong> ${escapeHtml(work.summary)}</p>`;
    if (work.genre) html += `<p><strong>Genre :</strong> ${escapeHtml(work.genre)}</p>`;
    if (work.tradition) html += `<p><strong>Tradition :</strong> ${escapeHtml(work.tradition)}</p>`;
    if (work.thematicKeywords && work.thematicKeywords.length > 0) {
      html += `<p><strong>Thématiques :</strong> ${escapeHtml(work.thematicKeywords.join(", "))}</p>`;
    }
    const actants = work.mainActants ?? null;
    if (actants) {
      const items = ACTANT_ROLES.filter((k) => actants[k]).map(
        (k) => `<li><strong>${escapeHtml(capitalize(k))} :</strong> ${escapeHtml(actants[k] as string)}</li>`,
      );
      if (items.length > 0) {
        html += `<p><strong>Schéma actantiel :</strong></p><ul style="font-size:0.9rem;margin:0.3rem 0;">${items.join("")}</ul>`;
      }
    }
    if (typeof work.costUsd === "number") {
      html += `<p style="font-size:0.85rem;color:#595959;"><em>Analyse LLM : ${work.costUsd.toFixed(4)} USD consommés</em></p>`;
    }
    html += "</div>";
    return html;
  };

  return `
<h2>Analyse sémantique (mode LLM)</h2>
<div class="works">
    ${workBlock(refWork, "Œuvre de référence")}
    ${workBlock(candWork, "Œuvre candidate")}
</div>
`;
}

export function renderComparisonHtmlReport(data: ComparisonHtmlReportData): string {
  const { refWork, candWork } = data;
  const srjColor = SRJ_COLORS[data.srjLevel] ?? "#595959";

  const correspondencesRows = data.correspondences
    .slice(0, 15)
    .map(
      (c, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td><code>${escapeHtml(c.refNode || "—")}</code> (${escapeHtml(c.refFunction || "—")})</td>
                    <td><code>${escapeHtml(c.candNode || "—")}</code> (${escapeHtml(c.candFunction || "—")})</td>
                    <td>${((c.similarity ?? 0) * 100).toFixed(1)}%</td>
                </tr>
            `,
    )
    .join("");

  let warningsHtml = "";
  if (data.warnings && data.warnings.length > 0) {
    warningsHtml =
      "<div class='warnings'><h3>⚠ Avertissements méthodologiques</h3><ul>" +
      data.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("") +
      "</ul></div>";
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport NARR'IA — ${escapeHtml(refWork.title)} vs ${escapeHtml(candWork.title)}</title>
<style>
body {
    font-family: Georgia, serif;
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
    color: #1A1A1A;
    background: #FAFAFA;
    line-height: 1.6;
}
h1 { color: #1F4E79; border-bottom: 4px solid #C55A11; padding-bottom: 0.5rem; }
h2 { color: #1F4E79; border-bottom: 2px solid #BDD7EE; padding-bottom: 0.3rem; margin-top: 2rem; }
h3 { color: #C55A11; }
.header-meta { background: #F2F2F2; padding: 1rem; border-radius: 4px; margin-bottom: 2rem; }
.header-meta p { margin: 0.3rem 0; }
.works { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1.5rem 0; }
.work { background: white; padding: 1rem; border-radius: 4px; border-left: 4px solid #1F4E79; }
.work.cand { border-left-color: #C55A11; }
.scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
.score-card { background: white; padding: 1rem; border-radius: 4px; text-align: center; border-top: 3px solid #1F4E79; }
.score-card.highlight { border-top-color: #C55A11; background: #FCE4D6; }
.score-label { font-size: 0.8rem; color: #595959; text-transform: uppercase; font-family: Arial, sans-serif; }
.score-value { font-size: 2.2rem; font-weight: bold; color: #1F4E79; font-family: Arial, sans-serif; }
.score-card.highlight .score-value { color: #C55A11; }
.verdict { background: #BDD7EE; padding: 1.2rem; border-left: 4px solid #1F4E79; border-radius: 4px; margin: 1.5rem 0; }
.verdict.warning { background: #FCE4D6; border-left-color: #C55A11; }
.warnings { background: #FCE4D6; padding: 1rem 1.5rem; border-left: 4px solid #C55A11; border-radius: 4px; margin: 1.5rem 0; }
.methodological-note { background: #F2F2F2; padding: 1rem 1.5rem; border-left: 4px solid #888888; border-radius: 4px; margin: 1.5rem 0; font-size: 0.95em; }
.methodological-note h3 { margin-top: 0; color: #555555; font-size: 1.05em; }
.methodological-note p { margin: 0.5rem 0; }
.warnings ul { margin: 0.3rem 0; padding-left: 1.5rem; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.92rem; }
th { background: #1F4E79; color: white; padding: 0.5rem; text-align: left; font-family: Arial, sans-serif; }
td { padding: 0.5rem; border-bottom: 1px solid #CCCCCC; }
tr:nth-child(even) { background: #F2F2F2; }
code { background: #FCE4D6; padding: 0.1rem 0.4rem; border-radius: 2px; font-size: 0.88rem; font-weight: bold; color: #C55A11; }
.tension-container { display: flex; align-items: flex-end; gap: 2px; height: 60px; padding: 0.5rem 0; }
.tbar { width: 12px; border-radius: 2px 2px 0 0; }
.srj-badge { display: inline-block; padding: 0.3rem 0.8rem; border-radius: 3px; color: white; font-weight: bold; font-family: Arial, sans-serif; }
.footer { margin-top: 3rem; padding-top: 1rem; border-top: 2px solid #1F4E79; font-size: 0.85rem; color: #595959; text-align: center; }
.footer p { margin: 0.3rem 0; }
</style>
</head>
<body>

<h1>Rapport NARR'IA</h1>

<div class="header-meta">
    <p><strong>Date d'analyse :</strong> ${escapeHtml(data.dateHuman)}</p>
    <p><strong>Système :</strong> NARR'IA v${VERSION} — Narratologie computationnelle du plagiat d'intrigue</p>
    <p><strong>Nature :</strong> Analyse de similarité structurale entre deux œuvres narratives</p>
</div>

<h2>Œuvres comparées</h2>
<div class="works">
    <div class="work">
        <h3>Œuvre de référence</h3>
        <p><strong>${escapeHtml(refWork.title)}</strong></p>
        <p><em>${escapeHtml(refWork.author)}</em></p>
        <p>Graphe narratif : <code>${escapeHtml(refWork.graphId)}</code> — ${refWork.nNodes} nœuds, ${refWork.nEdges} transitions</p>
        ${tensionBars(refWork.tensionProfile, "#1F4E79")}
    </div>
    <div class="work cand">
        <h3>Œuvre candidate</h3>
        <p><strong>${escapeHtml(candWork.title)}</strong></p>
        <p><em>${escapeHtml(candWork.author)}</em></p>
        <p>Graphe narratif : <code>${escapeHtml(candWork.graphId)}</code> — ${candWork.nNodes} nœuds, ${candWork.nEdges} transitions</p>
        ${tensionBars(candWork.tensionProfile, "#C55A11")}
    </div>
</div>

${renderLlmMetadata(refWork, candWork)}

<h2>Scores composites</h2>
<div class="scores">
    <div class="score-card highlight">
        <div class="score-label">SNS</div>
        <div class="score-value">${data.sns.toFixed(3)}</div>
        <div>Similarité narrative</div>
    </div>
    <div class="score-card">
        <div class="score-label">SNS_N</div>
        <div class="score-value">${data.snsNormalized.toFixed(3)}</div>
        <div>Normalisé / genre</div>
    </div>
    <div class="score-card">
        <div class="score-label">SS</div>
        <div class="score-value">${data.ss.toFixed(3)}</div>
        <div>Spécificité</div>
    </div>
    <div class="score-card">
        <div class="score-label">ST</div>
        <div class="score-value">${data.st.toFixed(3)}</div>
        <div>Transformation</div>
    </div>
    <div class="score-card">
        <div class="score-label">SRJ</div>
        <div class="score-value">${data.srj.toFixed(3)}</div>
        <div><span class="srj-badge" style="background: ${srjColor};">${escapeHtml(data.srjLevel)}</span></div>
    </div>
</div>

<h2>Verdict interprétatif</h2>
<div class="verdict ${data.sns > 0.5 ? "warning" : ""}">
    <p><strong>Modalité détectée :</strong> ${escapeHtml(data.detectedModality)}</p>
    <p>${escapeHtml(data.verdict)}</p>
</div>

${warningsHtml}

<h2>Détail des composantes du SNS</h2>
<table>
    <tr><th>Composante</th><th>Description</th><th>Score</th></tr>
    <tr><td>S_ISO</td><td>Isomorphisme de sous-graphes narratifs (NARR'IA-VF2)</td><td>${data.sIso.toFixed(3)}</td></tr>
    <tr><td>S_GED</td><td>Distance d'édition de graphes narratifs (GED narrative)</td><td>${data.sGed.toFixed(3)}</td></tr>
    <tr><td>S_FUNC</td><td>Similarité des séquences de fonctions narratives (DTW)</td><td>${data.sFunc.toFixed(3)}</td></tr>
    <tr><td>S_ACT</td><td>Similarité des chaînes actantielles</td><td>${data.sAct.toFixed(3)}</td></tr>
    <tr><td>S_TENS</td><td>Corrélation des signatures tensives</td><td>${data.sTens.toFixed(3)}</td></tr>
</table>

<div class="methodological-note">
    <h3>Note méthodologique sur la lecture des scores</h3>
    <p>Les indicateurs primaires de NARR'IA, sur lesquels l'interprétation
    doit principalement s'appuyer, sont le <strong>SNS</strong> (similarité
    narrative composite), le <strong>S_ISO</strong> (isomorphisme structural)
    et le <strong>S_TENS</strong> (signature tensive), ainsi que le
    <strong>verdict modal</strong>. Ces indicateurs reposent sur des
    algorithmes structurellement stables.</p>
    <p>Les sous-scores <strong>S_ACT</strong> (chaînes actantielles) et
    <strong>ST</strong> (transformations) relèvent d'algorithmes
    sensibles à la formulation des actants extraits par le LLM et aux
    métadonnées formelles fournies. Ils constituent des <em>indicateurs
    secondaires</em> en cours de calibration empirique. Une certaine
    variabilité de ces deux scores entre exécutions est attendue et ne
    remet pas en cause la fiabilité du verdict global.</p>
    <p>Pour toute analyse rigoureuse, il convient d'interpréter ces deux
    sous-scores avec prudence et de privilégier l'expertise humaine du
    narratologue pour qualifier la nature exacte des transformations
    entre œuvres.</p>
</div>

<h2>Correspondances structurales principales</h2>
<table>
    <thead>
        <tr>
            <th>#</th>
            <th>Nœud de référence</th>
            <th>Nœud candidat</th>
            <th>Similarité</th>
        </tr>
    </thead>
    <tbody>
        ${correspondencesRows || '<tr><td colspan="4"><em>Aucune correspondance forte détectée.</em></td></tr>'}
    </tbody>
</table>

<h2>Limites et avertissements</h2>
<div class="warnings">
    <h3>À retenir impérativement</h3>
    <ul>
        <li>Les scores NARR'IA sont des <strong>estimations probabilistes</strong>, jamais des verdicts définitifs de plagiat.</li>
        <li>L'interprétation des résultats exige une <strong>expertise humaine</strong> (narratologue, juriste selon le contexte).</li>
        <li>Un SNS élevé peut refléter une <strong>convergence indépendante</strong> due à des conventions génériques communes, sans emprunt réel.</li>
        <li>Une accusation publique de plagiat <strong>ne peut en aucun cas</strong> se fonder sur ces seuls scores.</li>
        <li>Ce rapport ne constitue <strong>pas un avis juridique</strong>. Pour toute suite judiciaire, consulter un avocat spécialisé en propriété intellectuelle.</li>
    </ul>
</div>

<div class="footer">
    <p>NARR'IA · narria.tech · 2026</p>
</div>

</body>
</html>
`;
}
