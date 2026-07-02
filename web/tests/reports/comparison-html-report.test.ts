import { describe, it, expect } from "vitest";
import {
  renderComparisonHtmlReport,
  type ComparisonHtmlReportData,
} from "@/lib/reports/comparison-html-report";

const baseData: ComparisonHtmlReportData = {
  dateHuman: "29/05/2026, 19:24",
  refWork: {
    title: "Du Corbeau et du Renard",
    author: "Ésope",
    graphId: "g_ref_001",
    nNodes: 8,
    nEdges: 7,
    tensionProfile: [0.1, 0.3, 0.5, 0.8, 1.0, 0.9, 0.6, 0.1],
    mode: "llm",
    summary: "Un renard flatte un corbeau pour lui dérober son fromage.",
    genre: "Fable apologue",
    tradition: "Classique gréco-latine",
    thematicKeywords: ["vanité", "flatterie", "ruse"],
    mainActants: {
      protagoniste: "Renard",
      objet: "Fromage",
      destinateur: "Faim",
      destinataire: "Renard",
      adjuvant: "Flatterie",
      opposant: "Position du corbeau",
    },
    costUsd: 0.05,
  },
  candWork: {
    title: "Le Corbeau et le Renard",
    author: "Jean de La Fontaine",
    graphId: "g_cand_001",
    nNodes: 7,
    nEdges: 9,
    tensionProfile: [0.2, 0.4, 0.6, 0.9, 1.0, 0.7, 0.3],
    mode: "llm",
    summary: "Un corbeau séduit par la flatterie laisse tomber son fromage.",
    genre: "Fable morale",
    tradition: "Classique occidentale",
    thematicKeywords: ["flatterie", "vanité", "naïveté"],
    mainActants: {
      protagoniste: "Renard",
      objet: "Fromage",
      destinateur: "Appétit",
      destinataire: "Renard",
      adjuvant: "Éloquence",
      opposant: "Méfiance du corbeau",
    },
    costUsd: 0.046,
  },
  sns: 0.724,
  snsNormalized: 0.833,
  ss: 0.541,
  st: 0.277,
  srj: 0.606,
  srjLevel: "Élevé",
  sIso: 0.714,
  sGed: 0.481,
  sFunc: 0.791,
  sAct: 0.704,
  sTens: 0.976,
  detectedModality: "Transposition (contextes différents)",
  verdict: "Les deux œuvres partagent une structure narrative similaire.",
  correspondences: [
    { refNode: "n001", refFunction: "F11", candNode: "n001", candFunction: "F11", similarity: 0.865 },
    { refNode: "n005", refFunction: "F05", candNode: "n004", candFunction: "F05", similarity: 0.816 },
  ],
  warnings: ["Cette analyse est une aide à la décision, jamais un verdict."],
};

describe("renderComparisonHtmlReport", () => {
  const html = renderComparisonHtmlReport(baseData);

  it("reproduit la structure et la palette d'origine (claire)", () => {
    expect(html).toContain("<h1>Rapport NARR'IA</h1>");
    expect(html).toContain("#1F4E79");
    expect(html).toContain("#C55A11");
    expect(html).toContain("Georgia, serif");
    expect(html).toContain("Détail des composantes du SNS");
    expect(html).toContain("Isomorphisme de sous-graphes narratifs (NARR'IA-VF2)");
    expect(html).toContain("Correspondances structurales");
    expect(html).toContain("NARR'IA · narria.tech · 2026");
  });

  it("affiche le badge SRJ coloré selon le niveau", () => {
    expect(html).toContain('<span class="srj-badge" style="background: #C55A11;">Élevé</span>');
  });

  it("rend les scores avec 3 décimales et le pourcentage de similarité", () => {
    expect(html).toContain("0.724");
    expect(html).toContain("86.5%");
  });

  it("marque le verdict comme warning quand sns > 0.5", () => {
    expect(html).toContain('class="verdict warning"');
  });

  it("échappe les valeurs pour prévenir le XSS", () => {
    const xss = renderComparisonHtmlReport({
      ...baseData,
      refWork: { ...baseData.refWork, title: "<script>alert('x')</script>" },
      candWork: { ...baseData.candWork, summary: "<script>alert('x')</script>" },
    });
    expect(xss).not.toContain("<script>alert");
    expect(xss).toContain("&lt;script&gt;");
  });

  it("est robuste aux champs manquants (pas d'actants, pas de correspondances, profil vide)", () => {
    expect(() =>
      renderComparisonHtmlReport({
        ...baseData,
        refWork: { ...baseData.refWork, mainActants: null, tensionProfile: [] },
        candWork: { ...baseData.candWork, mainActants: null, tensionProfile: [] },
        correspondences: [],
        warnings: [],
      }),
    ).not.toThrow();
    const empty = renderComparisonHtmlReport({
      ...baseData,
      correspondences: [],
    });
    expect(empty).toContain("Aucune correspondance forte détectée.");
  });
});
