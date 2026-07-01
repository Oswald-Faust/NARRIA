import { describe, it, expect } from "vitest";
import { renderAnalysisHtmlReport } from "@/lib/reports/analysis-html-report";

describe("renderAnalysisHtmlReport", () => {
  const html = renderAnalysisHtmlReport({
    title: "Roméo et Juliette",
    author: "William Shakespeare",
    mode: "llm",
    summary: "Deux familles rivales, une passion tragique.",
    genre: "Tragédie",
    tradition: "Théâtre élisabéthain",
    thematicKeywords: ["amour", "destin", "vendetta"],
    mainActants: {
      v1: {
        protagoniste: "Roméo",
        objet: "L'amour de Juliette",
        destinateur: "Le destin",
        destinataire: "Roméo",
        adjuvant: "Frère Laurent",
        opposant: "Tybalt",
      },
      v2: {
        protagoniste: "Juliette",
        objet: "L'amour de Roméo",
        destinateur: "Le destin",
        destinataire: "Juliette",
        adjuvant: "La nourrice",
        opposant: "Le comte Pâris",
      },
    },
    nodes: [
      {
        nodeId: "N1",
        functionCode: "FN1",
        functionName: "Situation initiale",
        functionFamily: "Exposition",
        actants: ["Roméo", "Juliette"],
        modalities: { vouloir: 0.8, devoir: 0.2, pouvoir: 0.5, savoir: 0.3 },
        tension: 0.4,
        phase: "exposition",
        textExcerpt: "Deux maisons, égales en dignité...",
      },
    ],
    costUsd: 0.0123,
    tokensTotal: 4567,
    dateHuman: "1 juillet 2026 à 10:00",
  });

  it("conserve le titre principal fidèle à l'original", () => {
    expect(html).toContain("<h1>Analyse NARR'IA</h1>");
  });

  it("conserve la couleur bleu marine d'origine (#1F4E79)", () => {
    expect(html).toContain("#1F4E79");
  });

  it("conserve la couleur orange d'origine (#C55A11)", () => {
    expect(html).toContain("#C55A11");
  });

  it("conserve la police serif d'origine (Garamond, Georgia)", () => {
    expect(html).toContain("Garamond, Georgia, serif");
  });

  it("conserve le libellé de l'axe du désir du schéma actantiel", () => {
    expect(html).toContain("AXE DU DÉSIR");
  });

  it("conserve la section du graphe narratif", () => {
    expect(html).toContain("<h2>Graphe narratif");
  });

  it("échappe le HTML injecté dans title/summary/textExcerpt (protection XSS)", () => {
    const html = renderAnalysisHtmlReport({
      title: "<script>alert('xss')</script>",
      author: "Auteur",
      mode: "llm",
      summary: "Résumé avec <img src=x onerror=alert(1)>",
      nodes: [
        {
          nodeId: "n001",
          functionCode: "F01",
          functionName: "Départ",
          functionFamily: "Rupture initiale",
          actants: ["<b>Actant</b>"],
          modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
          tension: 0.2,
          phase: "Exposition",
          textExcerpt: "Citation avec <script>document.cookie</script>",
        },
      ],
      dateHuman: "01/07/2026",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain("<b>Actant</b>");
    expect(html).not.toContain("<script>document.cookie");
    expect(html).toContain("&lt;script&gt;");
  });

  it("ne plante pas si un nœud n'a pas de modalities", () => {
    expect(() =>
      renderAnalysisHtmlReport({
        title: "Test",
        author: "Auteur",
        mode: "heuristic",
        nodes: [
          {
            nodeId: "n001",
            functionCode: "F01",
            functionName: "Départ",
            functionFamily: "Rupture initiale",
            actants: [],
            modalities: undefined as unknown as { vouloir: number; devoir: number; pouvoir: number; savoir: number },
            tension: 0.2,
            phase: "Exposition",
            textExcerpt: "…",
          },
        ],
        dateHuman: "01/07/2026",
      }),
    ).not.toThrow();
  });
});
