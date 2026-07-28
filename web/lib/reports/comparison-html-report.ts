/**
 * Rendu HTML autoportant du rapport de comparaison — design clair aux couleurs de la
 * marque NARR'IA, aligné sur le rapport affiché à l'écran (`components/comparer/
 * comparison-report.tsx`). Sert aussi de source au PDF.
 */
import { badge, escapeHtml, htmlShell, srjBadgeColor, tensionBars } from "./report-theme";
import { isTropeCoincidence } from "@/lib/engine/comparison/content-similarity";
import { ENGINE_PARAMETERS, ENGINE_VERSION } from "@/lib/engine/version";

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
  /** Contenu réel des nœuds appariés (P0-3) — absent des comparaisons antérieures au 28/07/2026. */
  refExcerpt?: string;
  candExcerpt?: string;
  refActants?: string[];
  candActants?: string[];
  contentSimilarity?: number;
}

/** Couverture d'appariement (P1-6) — absente des comparaisons antérieures au 28/07/2026. */
export interface ComparisonReportCoverage {
  refNodes: number;
  candNodes: number;
  refMatched: number;
  candMatched: number;
  refOrphans: number;
  candOrphans: number;
  ratio: number;
}

export interface ComparisonReportGenre {
  refGenre: string;
  candGenre: string;
  sameGenre: boolean | null;
  crossGenre: boolean;
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
  coverage?: ComparisonReportCoverage;
  genre?: ComparisonReportGenre;
  normalizationApplied?: boolean;
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
  ["S_FUNC", "Similarité des séquences de fonctions narratives (LCS pondérée par spécificité)", "sFunc"],
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

  // P0-3 : le tableau des correspondances affiche le contenu réel des nœuds
  // appariés — sans lui, un appariement « n012 (F20) ↔ n007 (F20), 80 % » reste
  // invérifiable par le lecteur.
  const nodeDetail = (excerpt?: string, actants?: string[]): string => {
    const parts: string[] = [];
    if (excerpt) parts.push(`<em>« ${escapeHtml(excerpt)} »</em>`);
    if (actants && actants.length > 0) parts.push(`<span class="cost">Actants : ${escapeHtml(actants.join(", "))}</span>`);
    return parts.join("<br />");
  };

  const correspondencesRows =
    data.correspondences.length === 0
      ? '<tr><td colspan="4"><em>Aucune correspondance forte détectée.</em></td></tr>'
      : data.correspondences
          .slice(0, 15)
          .map((c, i) => {
            const refDetail = nodeDetail(c.refExcerpt, c.refActants);
            const candDetail = nodeDetail(c.candExcerpt, c.candActants);
            const detailRow =
              refDetail || candDetail
                ? `
        <tr class="detail">
          <td></td>
          <td>${refDetail}</td>
          <td>${candDetail}</td>
          <td>${typeof c.contentSimilarity === "number" ? `contenu ${(c.contentSimilarity * 100).toFixed(0)} %` : ""}${
            isTropeCoincidence(c.similarity ?? 0, c.contentSimilarity)
              ? `<div class="trope">⚠ coïncidence de trope — la fonction concorde, pas le fond</div>`
              : ""
          }</td>
        </tr>`
                : "";
            return `
        <tr>
          <td>${i + 1}</td>
          <td><code>${escapeHtml(c.refNode || "—")}</code> (${escapeHtml(c.refFunction || "—")})</td>
          <td><code>${escapeHtml(c.candNode || "—")}</code> (${escapeHtml(c.candFunction || "—")})</td>
          <td>${((c.similarity ?? 0) * 100).toFixed(1)}%</td>
        </tr>${detailRow}`;
          })
          .join("");

  // P1-6 : la couverture est publiée, et non plus masquée derrière le composite.
  const coverageHtml = data.coverage
    ? `<h2 class="section">Couverture de l'appariement</h2>
<div class="callout">
  <p>Nœuds appariés : <strong>${data.coverage.refMatched}/${data.coverage.refNodes}</strong> pour l'œuvre de référence, <strong>${data.coverage.candMatched}/${data.coverage.candNodes}</strong> pour l'œuvre candidate — taux global <strong>${(data.coverage.ratio * 100).toFixed(0)} %</strong>.</p>
  <p>Nœuds orphelins (aucune correspondance de contenu) : ${data.coverage.refOrphans} côté référence, ${data.coverage.candOrphans} côté candidat.</p>
  ${
    data.coverage.ratio < 0.35
      ? "<p><strong>Couverture faible :</strong> les scores ne portent que sur une portion minoritaire des deux récits — l'essentiel des deux œuvres n'est expliqué par aucune correspondance.</p>"
      : ""
  }
</div>`
    : "";

  const genreHtml =
    data.genre && data.genre.crossGenre
      ? `<div class="callout callout--warn" style="margin-top:14px">
           <p><strong>Comparaison inter-genres :</strong> « ${escapeHtml(data.genre.refGenre)} » vs « ${escapeHtml(data.genre.candGenre)} ». La normalisation par genre (SNS_N) a été neutralisée : aucune référence d'interprétation n'existe entre genres distincts.</p>
         </div>`
      : "";

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
  <div class="score"><div class="lbl">SNS_N</div><div class="val">${data.snsNormalized.toFixed(3)}</div><div class="cap">${data.normalizationApplied === false ? "Normalisation neutralisée" : "Normalisé / genre"}</div></div>
  <div class="score"><div class="lbl">SS</div><div class="val">${data.ss.toFixed(3)}</div><div class="cap">Spécificité</div></div>
  <div class="score"><div class="lbl">ST</div><div class="val">${data.st.toFixed(3)}</div><div class="cap">Transformation</div></div>
  <div class="score"><div class="lbl">SRJ</div><div class="val">${data.srj.toFixed(3)}</div><div class="cap"><span class="badge" style="background:${srj.bg};color:${srj.fg}">${escapeHtml(data.srjLevel)}</span></div></div>
</div>

<h2 class="section">Verdict interprétatif</h2>
<div class="callout ${highSim ? "callout--alert" : ""}">
  <p><strong>Modalité détectée :</strong> ${escapeHtml(data.detectedModality)}</p>
  <p>${escapeHtml(data.verdict)}</p>
</div>
${genreHtml}

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
  <p>Le <strong>graphe narratif lui-même</strong> est le produit d'une extraction par modèle de langue : son découpage en nœuds varie d'une exécution à l'autre. <em>Tous</em> les sous-scores en héritent — S_ISO, S_GED et S_FUNC compris, et non les seuls S_ACT et ST. Le tableau ci-dessus doit se lire à cette échelle : des écarts de quelques centièmes entre deux analyses des mêmes textes sont attendus.</p>
  <p>L'interprétation doit s'appuyer d'abord sur le <strong>SNS</strong> (similarité narrative composite), le <strong>S_ISO</strong> (isomorphisme structural, pondéré par la spécificité des fonctions appariées) et le <strong>taux de couverture</strong>, qui indique quelle proportion des deux récits les correspondances expliquent réellement. Un score composite élevé sur une couverture faible ne signale rien de narrativement consistant.</p>
  <p>Le <strong>S_TENS</strong> (signature tensive) mesure la ressemblance des courbes dramatiques. La courbe exposition-montée-climax-résolution étant commune à la quasi-totalité des récits, un S_TENS élevé indique une convention de genre partagée bien plus souvent qu'un emprunt : il ne doit jamais être lu isolément. Les sous-scores <strong>S_ACT</strong> (chaînes actantielles) et <strong>ST</strong> (transformations) restent particulièrement sensibles à la formulation des actants extraits et demeurent en cours de calibration empirique.</p>
  <p>Pour toute analyse rigoureuse, il convient de vérifier les correspondances une à une — leur contenu est cité dans le tableau ci-dessus — et de privilégier l'expertise humaine du narratologue pour qualifier la nature exacte des rapports entre œuvres.</p>
</div>

<h2 class="section">Correspondances structurales principales</h2>
<table>
  <thead><tr><th>#</th><th>Nœud de référence</th><th>Nœud candidat</th><th>Similarité</th></tr></thead>
  <tbody>${correspondencesRows}</tbody>
</table>

${coverageHtml}

<h2 class="section">Paramètres du moteur</h2>
<table>
  <thead><tr><th>Paramètre</th><th>Valeur</th></tr></thead>
  <tbody>
    <tr><td>Version du moteur</td><td><strong>${ENGINE_VERSION}</strong></td></tr>
    <tr><td>Seuil d'appariement</td><td>${ENGINE_PARAMETERS.matchThreshold}</td></tr>
    <tr><td>Seuil de contenu</td><td>${ENGINE_PARAMETERS.contentThreshold}</td></tr>
    <tr><td>Profil de pondération</td><td>${ENGINE_PARAMETERS.weightProfile}</td></tr>
  </tbody>
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
