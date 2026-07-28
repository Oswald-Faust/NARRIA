/**
 * Rendu Markdown d'un rapport d'analyse — même contenu que le rapport HTML/écran,
 * au format texte portable (GitHub-flavored Markdown).
 */
import type { MainActants } from "./actantial-geometry";
import type { AnalysisReportData } from "@/components/analyse/analysis-report";

const ACTANT_LABELS: [keyof MainActants, string][] = [
  ["protagoniste", "Sujet (protagoniste)"],
  ["objet", "Objet de la quête"],
  ["destinateur", "Destinateur"],
  ["destinataire", "Destinataire"],
  ["adjuvant", "Adjuvant"],
  ["opposant", "Opposant"],
];

export function renderAnalysisMarkdownReport(analysis: AnalysisReportData & { dateHuman: string }): string {
  const out: string[] = [];

  out.push(`# Rapport d'analyse narrative NARR'IA`, "");
  out.push(`**${analysis.title}** — *${analysis.author}*`, "");
  out.push(`_Généré le ${analysis.dateHuman} · Mode : ${analysis.mode}_`, "");

  if (analysis.summary || analysis.genre || analysis.mainActants?.v1) {
    out.push(`## Synthèse de l'analyse`, "");
    if (analysis.summary) out.push(analysis.summary, "");
    if (analysis.genre) out.push(`**Genre :** ${analysis.genre}`);
    if (analysis.tradition) out.push(`**Filiation narrative du texte :** ${analysis.tradition}`);
    if (analysis.thematicKeywords && analysis.thematicKeywords.length > 0) {
      out.push(`**Thématiques :** ${analysis.thematicKeywords.join(", ")}`);
    }
    out.push("");
    const actantsV1 = analysis.mainActants?.v1;
    if (actantsV1) {
      const rows = ACTANT_LABELS.filter(([k]) => actantsV1[k]).map(([k, lbl]) => `| ${lbl} | ${actantsV1[k]} |`);
      if (rows.length > 0) {
        out.push(`### Schéma actantiel identifié`, "");
        out.push(`| Rôle | Valeur |`, `| --- | --- |`, ...rows, "");
      }
    }
  }

  const functionCodes = analysis.nodes.map((n) => n.functionCode).filter((c): c is string => !!c);
  if (functionCodes.length > 0) {
    out.push(`## Séquence de fonctions`, "", functionCodes.map((c) => `\`${c}\``).join(" · "), "");
  }

  out.push(`## Graphe narratif (${analysis.nodes.length} nœuds)`, "");
  if (analysis.nodes.length === 0) {
    out.push(`_Aucun nœud narratif détecté._`, "");
  } else {
    analysis.nodes.forEach((n, i) => {
      const head = [`### Nœud ${i + 1}${n.nodeId ? ` · ${n.nodeId}` : ""}`];
      out.push(...head, "");
      if (n.functionCode) out.push(`- **Fonction :** \`${n.functionCode}\`${n.functionName ? ` — ${n.functionName}` : ""}`);
      if (n.functionFamily) out.push(`- **Famille :** ${n.functionFamily}`);
      if (n.phase) out.push(`- **Phase :** ${n.phase}`);
      if (n.actants.length > 0) out.push(`- **Actants :** ${n.actants.join(", ")}`);
      const m = n.modalities ?? { vouloir: 0, devoir: 0, pouvoir: 0, savoir: 0 };
      out.push(
        `- **Modalités :** vouloir=${m.vouloir.toFixed(2)} · devoir=${m.devoir.toFixed(2)} · pouvoir=${m.pouvoir.toFixed(2)} · savoir=${m.savoir.toFixed(2)}`,
      );
      out.push(`- **Tension :** ${(n.tension ?? 0).toFixed(2)}`);
      if (n.textExcerpt) out.push("", `> ${n.textExcerpt.slice(0, 400)}`);
      out.push("");
    });
  }

  if (analysis.mode === "llm" && analysis.costUsd != null) {
    out.push(
      `_Analyse via Claude — coût : ${analysis.costUsd.toFixed(4)} USD · ${(analysis.tokensTotal ?? 0).toLocaleString("fr-FR")} tokens_`,
      "",
    );
  }

  out.push(`---`, `NARR'IA · narria.tech`);
  return out.join("\n");
}
