import { describe, it, expect } from "vitest";
import { shingles, compareTexts } from "@/lib/engine/comparison/text-overlap";
import { extractionKey, normalizeForHash } from "@/lib/engine/extraction/extraction-key";

const LONG = `
Il était une fois, dans un village au bord du fleuve, une jeune fille nommée Aïcha
qui gardait les chèvres de son père. Un matin, elle vit passer un cavalier vêtu de
blanc qui lui demanda le chemin de la source. Elle le lui indiqua sans méfiance.
Le soir venu, le cavalier revint et emporta la plus belle des chèvres. Aïcha
pleura longtemps, puis décida de partir à sa recherche à travers la savane.
Elle marcha sept jours et sept nuits avant d'atteindre la cité de cuivre.
`.trim();

describe("shingles — empreintes par n-grammes", () => {
  it("produit les suites de k mots consécutifs", () => {
    const s = shingles("le chat dort sur le tapis", 3);
    expect(s.has("le chat dort")).toBe(true);
    expect(s.has("chat dort sur")).toBe(true);
    expect(s.size).toBe(4);
  });

  it("ignore ponctuation, casse et diacritiques", () => {
    const a = shingles("L'Été, à Conakry !", 2);
    const b = shingles("l ete a conakry", 2);
    expect([...a]).toEqual([...b]);
  });

  it("ne renvoie pas un ensemble vide pour un texte plus court que k", () => {
    expect(shingles("deux mots", 5).size).toBe(1);
  });
});

describe("compareTexts — confinement littéral", () => {
  it("détecte un extrait intégralement repris (confinement ≈ 1)", () => {
    const excerpt = LONG.slice(0, Math.round(LONG.length * 0.3));
    const r = compareTexts(LONG, excerpt);
    expect(r.containment).toBeGreaterThan(0.9);
    expect(r.direction).toBe("cand_in_ref");
    // Le Jaccard, lui, reste bas : c'est exactement la raison d'être du confinement.
    expect(r.jaccard).toBeLessThan(0.5);
  });

  it("vaut 1 dans les deux sens sur un texte identique", () => {
    const r = compareTexts(LONG, LONG);
    expect(r.containment).toBeCloseTo(1, 5);
    expect(r.jaccard).toBeCloseTo(1, 5);
    expect(r.direction).toBeNull();
  });

  it("reste bas sur deux textes sans reprise littérale", () => {
    const other =
      "Un ingénieur de Lyon révise le moteur d'une turbine avant la mise en service, " +
      "puis rédige un rapport détaillé pour le comité de sécurité industrielle.";
    const r = compareTexts(LONG, other);
    expect(r.containment).toBeLessThan(0.1);
  });

  it("ne se prononce pas sur un texte vide", () => {
    expect(compareTexts("", LONG).containment).toBe(0);
  });
});

describe("extractionKey — empreinte de cache", () => {
  it("est stable pour un même texte", () => {
    expect(extractionKey(LONG)).toBe(extractionKey(LONG));
  });

  it("absorbe les écarts de mise en forme sans portée sémantique", () => {
    const windows = LONG.replace(/\n/g, "\r\n").replace(/ /g, "  ");
    expect(extractionKey(windows)).toBe(extractionKey(LONG));
  });

  it("distingue deux textes différents", () => {
    expect(extractionKey(LONG)).not.toBe(extractionKey(LONG + " Fin."));
  });

  it("distingue deux modèles ou deux modes d'extraction", () => {
    expect(extractionKey(LONG, { mode: "llm", model: "a" })).not.toBe(
      extractionKey(LONG, { mode: "llm", model: "b" }),
    );
    expect(extractionKey(LONG, { mode: "llm" })).not.toBe(extractionKey(LONG, { mode: "heuristic" }));
  });

  it("préserve la casse et la ponctuation, porteuses de sens", () => {
    expect(normalizeForHash("Il partit. Puis revint")).toBe("Il partit. Puis revint");
    expect(extractionKey("Il partit.")).not.toBe(extractionKey("il partit"));
  });
});
