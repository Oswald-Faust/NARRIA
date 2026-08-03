/**
 * Banc de mesure de la variance d'extraction : les indicateurs doivent être
 * justes sur des cas construits, sans quoi ils ne prouveraient rien sur des cas
 * réels.
 */
import { describe, it, expect } from "vitest";
import {
  measureStability,
  multisetJaccard,
  positionalAgreement,
  anchorIou,
  spanIou,
  gradeStability,
  formatStabilityReport,
  standardDeviation,
  mean,
  STABILITY_TARGETS,
} from "@/lib/engine/extraction/stability";
import type { LlmAnalysis, LlmNode } from "@/lib/engine/extraction/llm-schema";

function node(code: string, span?: [number, number]): LlmNode {
  return {
    sequence: 1,
    function_code: code,
    function_name: code,
    function_family: "test",
    actants: [],
    modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
    tension: 0.5,
    phase: "Exposition",
    text_excerpt: code,
    justification: "",
    ...(span ? { _char_start: span[0], _char_end: span[1] } : {}),
  };
}

function analysis(nodes: LlmNode[]): LlmAnalysis {
  return {
    summary: "", genre: "", tradition: "",
    formal_features: {
      form: "prose", register: "narratif_neutre", narrative_length_category: "court",
      approximate_word_count: 100, has_explicit_morality: false,
      has_narrator_intervention: false, uses_dialogue: false, stylistic_signature: "",
    },
    nodes,
    main_actants_v1: { _focus: "", _description: "", protagoniste: "", objet: "", destinateur: "", destinataire: "", adjuvant: "", opposant: "" },
    main_actants_v2: { _focus: "", _description: "", protagoniste: "", objet: "", destinateur: "", destinataire: "", adjuvant: "", opposant: "" },
    thematic_keywords: [],
  };
}

const FONCTIONS = ["F01", "F10", "F20", "F30", "F40"];
const passeStable = () => analysis(FONCTIONS.map((f, i) => node(f, [i * 100, i * 100 + 90])));

describe("Statistiques de base", () => {
  it("calcule moyenne et écart-type de population", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(standardDeviation([2, 4, 6])).toBeCloseTo(1.632993, 5);
    expect(standardDeviation([5])).toBe(0);
  });
});

describe("multisetJaccard", () => {
  it("vaut 1 sur deux multiensembles identiques", () => {
    const a = new Map([["F20", 3], ["F10", 1]]);
    expect(multisetJaccard(a, new Map(a))).toBe(1);
  });

  it("pénalise un écart de comptage qu'un Jaccard ensembliste ignorerait", () => {
    const a = new Map([["F20", 3]]);
    const b = new Map([["F20", 1]]);
    expect(multisetJaccard(a, b)).toBeCloseTo(1 / 3, 6);
  });

  it("vaut 0 sur des répertoires disjoints", () => {
    expect(multisetJaccard(new Map([["F20", 1]]), new Map([["F40", 1]]))).toBe(0);
  });

  it("vaut 1 sur deux ensembles vides", () => {
    expect(multisetJaccard(new Map(), new Map())).toBe(1);
  });
});

describe("positionalAgreement", () => {
  it("vaut 1 quand les fonctions occupent les mêmes positions relatives", () => {
    expect(positionalAgreement(passeStable(), passeStable())).toBe(1);
  });

  it("chute quand l'ordre des fonctions change", () => {
    const inverse = analysis([...FONCTIONS].reverse().map((f) => node(f)));
    expect(positionalAgreement(passeStable(), inverse)).toBeLessThan(0.5);
  });

  it("est pénalisé par un nœud surnuméraire", () => {
    const plusUn = analysis([...FONCTIONS, "F50"].map((f) => node(f)));
    const accord = positionalAgreement(passeStable(), plusUn);
    expect(accord).toBeLessThan(1);
    expect(accord).toBeGreaterThan(0);
  });

  it("vaut 0 face à une passe vide, 1 entre deux passes vides", () => {
    expect(positionalAgreement(passeStable(), analysis([]))).toBe(0);
    expect(positionalAgreement(analysis([]), analysis([]))).toBe(1);
  });
});

describe("spanIou et anchorIou", () => {
  it("mesure le recouvrement de deux plages", () => {
    expect(spanIou({ start: 0, end: 100 }, { start: 0, end: 100 })).toBe(1);
    expect(spanIou({ start: 0, end: 100 }, { start: 200, end: 300 })).toBe(0);
    expect(spanIou({ start: 0, end: 100 }, { start: 50, end: 150 })).toBeCloseTo(50 / 150, 6);
  });

  it("vaut 1 entre deux passes ancrées identiquement", () => {
    expect(anchorIou(passeStable(), passeStable())).toBe(1);
  });

  it("décroît quand les frontières se décalent", () => {
    const decale = analysis(FONCTIONS.map((f, i) => node(f, [i * 100 + 40, i * 100 + 130])));
    const iou = anchorIou(passeStable(), decale)!;
    expect(iou).toBeGreaterThan(0);
    expect(iou).toBeLessThan(1);
  });

  it("apparie optimalement plutôt que gloutonnement", () => {
    // Deux nœuds dont l'appariement glouton ferait un mauvais choix initial.
    const a = analysis([node("F10", [0, 100]), node("F20", [100, 200])]);
    const b = analysis([node("F10", [90, 195]), node("F20", [0, 95])]);
    // L'optimal apparie a0↔b1 et a1↔b0 : recouvrement élevé sur les deux.
    expect(anchorIou(a, b)!).toBeGreaterThan(0.8);
  });

  it("pénalise un nœud sans partenaire au lieu de l'ignorer", () => {
    const a = analysis([node("F10", [0, 100])]);
    const b = analysis([node("F10", [0, 100]), node("F20", [500, 600])]);
    expect(anchorIou(a, b)!).toBeCloseTo(0.5, 6);
  });

  it("retourne null quand une passe n'est pas ancrée", () => {
    expect(anchorIou(passeStable(), analysis(FONCTIONS.map((f) => node(f))))).toBeNull();
  });
});

describe("measureStability", () => {
  it("rapporte une variance nulle sur des passes identiques", () => {
    const rapport = measureStability([passeStable(), passeStable(), passeStable()]);
    expect(rapport.passes).toBe(3);
    expect(rapport.nodeCounts).toEqual([5, 5, 5]);
    expect(rapport.nodeCountSd).toBe(0);
    expect(rapport.nodeCountCv).toBe(0);
    expect(rapport.functionJaccard).toBe(1);
    expect(rapport.positionalAgreement).toBe(1);
    expect(rapport.anchorIou).toBe(1);
    expect(rapport.anchoredRatio).toBe(1);
    expect(gradeStability(rapport)).toBe("stable");
  });

  it("compare toutes les paires de passes", () => {
    const rapport = measureStability([passeStable(), passeStable(), passeStable(), passeStable()]);
    expect(rapport.pairwise).toHaveLength(6); // 4 × 3 / 2
  });

  it("reproduit le cas documenté par les bêta-testeurs (35 puis 33 nœuds)", () => {
    const p35 = analysis(Array.from({ length: 35 }, (_, i) => node(`F${i % 20}`)));
    const p33 = analysis(Array.from({ length: 33 }, (_, i) => node(`F${i % 20}`)));
    const rapport = measureStability([p35, p33]);
    expect(rapport.nodeCounts).toEqual([35, 33]);
    expect(rapport.nodeCountCv).toBeGreaterThan(0.02);
    expect(rapport.anchorIou).toBeNull();
    expect(rapport.anchoredRatio).toBe(0);
  });

  it("distingue deux passes de même effectif mais de contenus différents", () => {
    const a = analysis(FONCTIONS.map((f) => node(f)));
    const b = analysis(["F02", "F11", "F21", "F31", "F41"].map((f) => node(f)));
    const rapport = measureStability([a, b]);
    expect(rapport.nodeCountCv).toBe(0); // l'effectif ne dit rien...
    expect(rapport.functionJaccard).toBe(0); // ...mais le répertoire, si.
    expect(gradeStability(rapport)).toBe("instable");
  });

  it("refuse de conclure sur une passe unique", () => {
    const rapport = measureStability([passeStable()]);
    expect(rapport.passes).toBe(1);
    expect(gradeStability(rapport)).toBe("instable");
  });

  it("lève sur un jeu vide", () => {
    expect(() => measureStability([])).toThrow(/aucune passe/);
  });

  it("ignore l'ancrage absent au lieu de le compter comme réussi", () => {
    const nu = analysis(FONCTIONS.map((f) => node(f)));
    const rapport = measureStability([nu, nu]);
    expect(rapport.anchorIou).toBeNull();
    // Trois critères sur trois satisfaits, sans crédit pour l'ancrage manquant.
    expect(gradeStability(rapport)).toBe("stable");
  });
});

describe("gradeStability", () => {
  it("classe « acceptable » un seul critère manqué", () => {
    const base = measureStability([passeStable(), passeStable()]);
    const degrade = { ...base, nodeCountCv: STABILITY_TARGETS.nodeCountCv + 0.01 };
    expect(gradeStability(degrade)).toBe("acceptable");
  });

  it("classe « instable » deux critères manqués", () => {
    const base = measureStability([passeStable(), passeStable()]);
    const degrade = {
      ...base,
      nodeCountCv: 0.3,
      positionalAgreement: 0.2,
    };
    expect(gradeStability(degrade)).toBe("instable");
  });
});

describe("formatStabilityReport", () => {
  const rapport = measureStability([passeStable(), passeStable()]);

  it("publie tous les indicateurs avec leur cible", () => {
    const texte = formatStabilityReport(rapport, "témoin");
    expect(texte).toContain("témoin");
    expect(texte).toContain("Coeff. de variation");
    expect(texte).toContain("Accord fonctions");
    expect(texte).toContain("Recouvrement ancres");
    expect(texte).toContain("STABLE");
  });

  it("signale explicitement une mesure absente", () => {
    const nu = analysis(FONCTIONS.map((f) => node(f)));
    const texte = formatStabilityReport(measureStability([nu, nu]));
    expect(texte).toContain("non mesuré");
  });
});
