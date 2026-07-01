import { describe, it, expect } from "vitest";
import { cleanText, removeRecurringLines, removePageNumbers } from "@/lib/engine/extraction/file-extractor";

describe("removePageNumbers", () => {
  it("retire les lignes qui ne contiennent qu'un numéro de page", () => {
    const text = "Premier paragraphe.\n12\nDeuxième paragraphe.\n- 13 -\nTroisième.";
    const result = removePageNumbers(text);
    expect(result).not.toContain("\n12\n");
    expect(result).not.toContain("- 13 -");
    expect(result).toContain("Premier paragraphe.");
    expect(result).toContain("Troisième.");
  });
});

describe("removeRecurringLines", () => {
  it("retire les lignes répétées ≥3 fois, courtes, ne commençant pas par une minuscule", () => {
    const text = [
      "CHAPITRE PREMIER",
      "Il était une fois un roi.",
      "NARR'IA — Rapport",
      "Le roi avait trois filles.",
      "NARR'IA — Rapport",
      "La plus jeune était la plus belle.",
      "NARR'IA — Rapport",
    ].join("\n");
    const result = removeRecurringLines(text);
    expect(result).not.toContain("NARR'IA — Rapport");
    expect(result).toContain("Il était une fois un roi.");
  });

  it("ne retire pas une ligne qui commence par une minuscule même répétée", () => {
    const text = ["et voici", "et voici", "et voici", "Une phrase normale."].join("\n");
    const result = removeRecurringLines(text);
    expect(result).toContain("et voici");
  });
});

describe("cleanText", () => {
  it("normalise les fins de ligne, retire les caractères de contrôle, réduit les espaces multiples", () => {
    const dirty = "Bonjour\r\nle    monde\x00\x01\n\n\n\nFin.";
    const result = cleanText(dirty, "pdf");
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\x00");
    expect(result).toContain("le monde");
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("applique la suppression de headers/footers uniquement pour le format pdf", () => {
    const text = ["Titre.", "REPEAT", "Contenu.", "REPEAT", "Suite.", "REPEAT"].join("\n");
    const cleanedPdf = cleanText(text, "pdf");
    expect(cleanedPdf).not.toContain("REPEAT");
    const cleanedTxt = cleanText(text, "txt");
    expect(cleanedTxt).toContain("REPEAT");
  });
});
