/**
 * Rendu Markdown du rapport de comparaison — même contenu que le rapport HTML/écran,
 * au format texte portable (GitHub-flavored Markdown).
 */
import type { ComparisonHtmlReportData, ComparisonReportWork } from "./comparison-html-report";

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

function workBlock(work: ComparisonReportWork, label: string): string {
  const lines = [`### ${label}`, "", `**${work.title}** — *${work.author}*`, "", `Graphe narratif : \`${work.graphId}\` — ${work.nNodes} nœuds, ${work.nEdges} transitions`];
  if (work.mode === "llm") {
    if (work.summary) lines.push("", `**Résumé :** ${work.summary}`);
    if (work.genre) lines.push("", `**Genre :** ${work.genre}`);
    if (work.tradition) lines.push(`**Tradition :** ${work.tradition}`);
    if (work.thematicKeywords && work.thematicKeywords.length > 0) {
      lines.push(`**Thématiques :** ${work.thematicKeywords.join(", ")}`);
    }
    const actants = work.mainActants ?? null;
    if (actants) {
      const items = ACTANT_ROLES.filter(([k]) => actants[k]).map(([k, lbl]) => `- **${lbl} :** ${actants[k]}`);
      if (items.length > 0) lines.push("", "**Schéma actantiel :**", "", ...items);
    }
    if (typeof work.costUsd === "number") lines.push("", `*Analyse LLM : ${work.costUsd.toFixed(4)} USD consommés*`);
  }
  return lines.join("\n");
}

export function renderComparisonMarkdownReport(data: ComparisonHtmlReportData): string {
  const { refWork, candWork } = data;
  const out: string[] = [];

  out.push(`# Rapport de comparaison NARR'IA`);
  out.push("");
  out.push(`**${refWork.title}** vs **${candWork.title}**`);
  out.push("");
  out.push(`_Généré le ${data.dateHuman} · Narratologie computationnelle du plagiat d'intrigue_`);
  out.push("");

  out.push(`## Œuvres comparées`, "");
  out.push(workBlock(refWork, "Œuvre de référence"), "");
  out.push(workBlock(candWork, "Œuvre candidate"), "");

  out.push(`## Scores composites`, "");
  out.push(`| Score | Valeur | Description |`);
  out.push(`| --- | --- | --- |`);
  out.push(`| **SNS** | ${data.sns.toFixed(3)} | Similarité narrative |`);
  out.push(`| SNS_N | ${data.snsNormalized.toFixed(3)} | Normalisé / genre |`);
  out.push(`| SS | ${data.ss.toFixed(3)} | Spécificité |`);
  out.push(`| ST | ${data.st.toFixed(3)} | Transformation |`);
  out.push(`| SRJ | ${data.srj.toFixed(3)} | Risque : **${data.srjLevel}** |`);
  out.push("");

  out.push(`## Verdict interprétatif`, "");
  out.push(`**Modalité détectée :** ${data.detectedModality}`, "");
  out.push(data.verdict, "");

  out.push(`## Détail des composantes du SNS`, "");
  out.push(`| Composante | Description | Score |`);
  out.push(`| --- | --- | --- |`);
  for (const [code, desc, key] of SNS_COMPONENTS) {
    out.push(`| ${code} | ${desc} | ${(data[key] as number).toFixed(3)} |`);
  }
  out.push("");

  out.push(`## Correspondances structurales principales`, "");
  if (data.correspondences.length === 0) {
    out.push(`_Aucune correspondance forte détectée._`, "");
  } else {
    out.push(`| # | Nœud de référence | Nœud candidat | Similarité |`);
    out.push(`| --- | --- | --- | --- |`);
    data.correspondences.slice(0, 15).forEach((c, i) => {
      out.push(
        `| ${i + 1} | \`${c.refNode || "—"}\` (${c.refFunction || "—"}) | \`${c.candNode || "—"}\` (${c.candFunction || "—"}) | ${((c.similarity ?? 0) * 100).toFixed(1)} % |`,
      );
    });
    out.push("");
  }

  out.push(`## Note méthodologique`, "");
  out.push(
    `Les indicateurs primaires (SNS, S_ISO, S_TENS et le verdict modal) reposent sur des algorithmes structurellement stables. Les sous-scores S_ACT et ST sont des indicateurs secondaires, sensibles à l'extraction LLM et en cours de calibration : une certaine variabilité est attendue et ne remet pas en cause le verdict global.`,
    "",
  );

  out.push(`## Limites et avertissements`, "");
  out.push(
    `- Les scores NARR'IA sont des **estimations probabilistes**, jamais des verdicts définitifs de plagiat.`,
    `- L'interprétation exige une **expertise humaine** (narratologue, juriste selon le contexte).`,
    `- Un SNS élevé peut refléter une **convergence indépendante** due à des conventions génériques communes.`,
    `- Une accusation publique de plagiat **ne peut en aucun cas** se fonder sur ces seuls scores.`,
    `- Ce rapport ne constitue **pas un avis juridique**.`,
    "",
  );

  if (data.warnings && data.warnings.length > 0) {
    out.push(`### Avertissements méthodologiques`, "");
    out.push(...data.warnings.map((w) => `- ${w}`), "");
  }

  out.push(`---`, `NARR'IA · narria.tech`);
  return out.join("\n");
}
