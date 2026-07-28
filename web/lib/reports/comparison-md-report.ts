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
  ["S_FUNC", "Similarité des séquences de fonctions narratives (LCS pondérée par spécificité)", "sFunc"],
  ["S_ACT", "Similarité des chaînes actantielles", "sAct"],
  ["S_TENS", "Corrélation des signatures tensives", "sTens"],
];

function workBlock(work: ComparisonReportWork, label: string): string {
  const lines = [`### ${label}`, "", `**${work.title}** — *${work.author}*`, "", `Graphe narratif : \`${work.graphId}\` — ${work.nNodes} nœuds, ${work.nEdges} transitions`];
  if (work.mode === "llm") {
    if (work.summary) lines.push("", `**Résumé :** ${work.summary}`);
    if (work.genre) lines.push("", `**Genre :** ${work.genre}`);
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
  out.push(
    `| SNS_N | ${data.snsNormalized.toFixed(3)} | ${data.normalizationApplied === false ? "Normalisation neutralisée" : "Normalisé / genre"} |`,
  );
  out.push(`| SS | ${data.ss.toFixed(3)} | Spécificité |`);
  out.push(`| ST | ${data.st.toFixed(3)} | Transformation |`);
  out.push(`| SRJ | ${data.srj.toFixed(3)} | Risque : **${data.srjLevel}** |`);
  out.push("");

  out.push(`## Verdict interprétatif`, "");
  out.push(`**Modalité détectée :** ${data.detectedModality}`, "");
  out.push(data.verdict, "");
  if (data.genre?.crossGenre) {
    out.push(
      `> **Comparaison inter-genres** — « ${data.genre.refGenre} » vs « ${data.genre.candGenre} ». La normalisation par genre (SNS_N) a été neutralisée : aucune référence d'interprétation n'existe entre genres distincts.`,
      "",
    );
  }

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
    // P0-3 : chaque appariement est accompagné du contenu réel des deux nœuds,
    // pour que le lecteur puisse vérifier ce que la correspondance recouvre.
    data.correspondences.slice(0, 15).forEach((c, i) => {
      const content =
        typeof c.contentSimilarity === "number" ? ` · recouvrement de contenu ${(c.contentSimilarity * 100).toFixed(0)} %` : "";
      out.push(
        `### ${i + 1}. \`${c.refNode || "—"}\` (${c.refFunction || "—"}) ↔ \`${c.candNode || "—"}\` (${c.candFunction || "—"}) — ${((c.similarity ?? 0) * 100).toFixed(1)} %${content}`,
        "",
      );
      if (c.refExcerpt) out.push(`- **Référence :** « ${c.refExcerpt} »`);
      if (c.refActants?.length) out.push(`  - Actants : ${c.refActants.join(", ")}`);
      if (c.candExcerpt) out.push(`- **Candidat :** « ${c.candExcerpt} »`);
      if (c.candActants?.length) out.push(`  - Actants : ${c.candActants.join(", ")}`);
      out.push("");
    });
  }

  if (data.coverage) {
    out.push(`## Couverture de l'appariement`, "");
    out.push(
      `- Œuvre de référence : **${data.coverage.refMatched}/${data.coverage.refNodes}** nœuds appariés (${data.coverage.refOrphans} orphelins)`,
      `- Œuvre candidate : **${data.coverage.candMatched}/${data.coverage.candNodes}** nœuds appariés (${data.coverage.candOrphans} orphelins)`,
      `- Taux de couverture global : **${(data.coverage.ratio * 100).toFixed(0)} %**`,
      "",
    );
    if (data.coverage.ratio < 0.35) {
      out.push(
        `> **Couverture faible** — les scores ne portent que sur une portion minoritaire des deux récits : l'essentiel des deux œuvres n'est expliqué par aucune correspondance.`,
        "",
      );
    }
  }

  out.push(`## Note méthodologique`, "");
  out.push(
    `Le graphe narratif est le produit d'une extraction par modèle de langue : son découpage en nœuds varie d'une exécution à l'autre, et **tous** les sous-scores en héritent — S_ISO, S_GED et S_FUNC compris, et non les seuls S_ACT et ST.`,
    "",
    `L'interprétation doit s'appuyer d'abord sur le SNS, le S_ISO (pondéré par la spécificité des fonctions appariées) et le **taux de couverture** : un score composite élevé sur une couverture faible ne signale rien de narrativement consistant.`,
    "",
    `Le S_TENS mesure la ressemblance des courbes dramatiques ; la courbe exposition-montée-climax-résolution étant commune à la quasi-totalité des récits, il indique une convention de genre partagée bien plus souvent qu'un emprunt. S_ACT et ST restent sensibles à la formulation des actants extraits et en cours de calibration empirique.`,
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
