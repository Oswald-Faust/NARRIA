/**
 * Consensus multi-passes révisé (août 2026) : alignement par coordonnées
 * textuelles et regroupement, en remplacement du filtrage de la passe pivot.
 *
 * Les tests historiques de `comparison-modules.test.ts` restent la garantie de
 * non-régression ; ceux-ci couvrent ce que l'ancienne version ne savait pas
 * faire — aligner deux passes de tailles différentes, et ne pas perdre un
 * événement que le pivot a manqué.
 */
import { describe, it, expect } from "vitest";
import { consensusMerge } from "@/lib/engine/extraction/consensus";
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
    text_excerpt: `extrait ${code}`,
    justification: "",
    ...(span ? { _char_start: span[0], _char_end: span[1] } : {}),
  };
}

function pass(nodes: LlmNode[]): LlmAnalysis {
  return {
    summary: "", genre: "", tradition: "",
    formal_features: {
      form: "prose", register: "narratif_neutre", narrative_length_category: "moyen",
      approximate_word_count: 500, has_explicit_morality: false,
      has_narrator_intervention: false, uses_dialogue: false, stylistic_signature: "",
    },
    nodes,
    main_actants_v1: { _focus: "", _description: "", protagoniste: "", objet: "", destinateur: "", destinataire: "", adjuvant: "", opposant: "" },
    main_actants_v2: { _focus: "", _description: "", protagoniste: "", objet: "", destinateur: "", destinataire: "", adjuvant: "", opposant: "" },
    thematic_keywords: [],
  };
}

const codes = (out: { analysis: LlmAnalysis }) => out.analysis.nodes.map((n) => n.function_code);

describe("Alignement par ancres", () => {
  it("reconnaît le même événement malgré un rang différent", () => {
    // Le pivot a 3 nœuds, les autres 4 : les rangs relatifs de F20 et F40 sont
    // décalés, mais leurs coordonnées textuelles coïncident.
    const courte = pass([node("F01", [0, 100]), node("F20", [400, 500]), node("F40", [800, 900])]);
    const longue = pass([
      node("F01", [0, 100]),
      node("F10", [200, 300]),
      node("F20", [400, 500]),
      node("F40", [800, 900]),
    ]);

    const out = consensusMerge([courte, longue, longue]);
    expect(out.variance.alignment).toBe("anchors");
    // F01, F20 et F40 sont vus par les trois passes ; F10 par deux sur trois.
    expect(codes(out)).toEqual(["F01", "F10", "F20", "F40"]);
  });

  it("apparie deux plages qui se recouvrent sans être identiques", () => {
    const a = pass([node("F20", [400, 500])]);
    const b = pass([node("F20", [420, 520])]);
    const out = consensusMerge([a, b]);
    expect(out.analysis.nodes).toHaveLength(1);
    expect(out.variance.alignment).toBe("anchors");
  });

  it("sépare deux plages disjointes portant la même fonction", () => {
    const a = pass([node("F20", [0, 100]), node("F20", [900, 1000])]);
    const out = consensusMerge([a, a]);
    // Deux combats distincts restent deux nœuds : l'ancrage les distingue.
    expect(out.analysis.nodes).toHaveLength(2);
  });

  it("n'apparie jamais deux nœuds d'une même passe", () => {
    // Deux F20 voisins dans la MÊME passe ne doivent pas fusionner : une passe
    // ne peut pas voter deux fois pour le même événement.
    const a = pass([node("F20", [400, 500]), node("F20", [410, 510])]);
    const out = consensusMerge([a, a]);
    expect(out.analysis.nodes).toHaveLength(2);
  });
});

describe("Réintégration des nœuds manqués par le pivot", () => {
  it("reconstitue l'union majoritaire quand chaque passe manque autre chose", () => {
    // Cas réaliste : aucune passe n'est complète, et chacune omet un événement
    // différent. L'ancienne version, qui filtrait le seul pivot, ne pouvait
    // jamais restituer plus que ce que le pivot avait vu.
    const sansF10 = pass([node("F01", [0, 100]), node("F20", [400, 500]), node("F40", [800, 900])]);
    const sansF20 = pass([node("F01", [0, 100]), node("F10", [200, 300]), node("F40", [800, 900])]);
    const complet = pass([
      node("F01", [0, 100]),
      node("F10", [200, 300]),
      node("F20", [400, 500]),
      node("F40", [800, 900]),
    ]);

    const out = consensusMerge([sansF10, sansF20, complet]);
    // Le pivot est `sansF10` (effectifs [3, 3, 4], médiane 3, premier atteint).
    // F10 est pourtant vu par deux passes sur trois : il est réintégré, à sa place.
    expect(codes(out)).toEqual(["F01", "F10", "F20", "F40"]);
    expect(out.variance.recoveredNodes).toBe(1);
    expect(out.analysis.nodes.map((n) => n.sequence)).toEqual([1, 2, 3, 4]);
    expect(out.variance.consensusNodes).toBeGreaterThan(sansF10.nodes.length);
  });

  it("ordonne les nœuds réintégrés par leur position textuelle", () => {
    // Le nœud manquant du pivot est en MILIEU de récit : il doit s'insérer là,
    // et non être concaténé en fin de graphe.
    const sansMilieu = pass([node("F01", [0, 100]), node("F40", [800, 900]), node("F49", [950, 999])]);
    const sansFin = pass([node("F01", [0, 100]), node("F20", [400, 500]), node("F40", [800, 900])]);
    const complet = pass([
      node("F01", [0, 100]),
      node("F20", [400, 500]),
      node("F40", [800, 900]),
      node("F49", [950, 999]),
    ]);

    const out = consensusMerge([sansMilieu, sansFin, complet]);
    expect(codes(out)).toEqual(["F01", "F20", "F40", "F49"]);
    expect(out.variance.alignment).toBe("anchors");
  });

  it("ne rétrécit plus le graphe en dessous du pivot sans raison", () => {
    const a = pass([node("F01", [0, 100]), node("F20", [400, 500]), node("F40", [800, 900])]);
    const out = consensusMerge([a, a, a]);
    expect(out.analysis.nodes).toHaveLength(3);
    expect(out.variance.agreementRatio).toBe(1);
    expect(out.variance.recoveredNodes).toBe(0);
  });
});

describe("Repli positionnel sur analyses non ancrées", () => {
  it("signale l'alignement employé", () => {
    const nu = pass([node("F01"), node("F20"), node("F40")]);
    const out = consensusMerge([nu, nu]);
    expect(out.variance.alignment).toBe("positional");
    expect(codes(out)).toEqual(["F01", "F20", "F40"]);
  });

  it("tolère un cran de décalage entre passes de tailles voisines", () => {
    const quatre = pass([node("F01"), node("F13"), node("F28"), node("F41")]);
    const cinq = pass([node("F01"), node("F13"), node("F22"), node("F28"), node("F41")]);
    const out = consensusMerge([quatre, quatre, cinq]);
    // F22, vu par une seule passe sur trois, est écarté ; les autres survivent
    // malgré le décalage de rang qu'il induit.
    expect(codes(out)).toEqual(["F01", "F13", "F28", "F41"]);
  });

  it("écarte un nœud isolé", () => {
    const avec = pass([node("F01"), node("F99"), node("F40")]);
    const sans = pass([node("F01"), node("F40")]);
    const out = consensusMerge([sans, sans, avec]);
    expect(codes(out)).not.toContain("F99");
  });
});

describe("Métriques de variance publiées", () => {
  it("expose l'effectif de chaque passe et son écart-type", () => {
    const a = pass([node("F01", [0, 100])]);
    const b = pass([node("F01", [0, 100]), node("F20", [400, 500])]);
    const out = consensusMerge([a, b, b]);
    expect(out.variance.nodeCounts).toEqual([1, 2, 2]);
    expect(out.variance.nodeCountSd).toBeCloseTo(0.4714, 3);
    expect(out.variance.passes).toBe(3);
  });

  it("laisse une passe unique strictement inchangée", () => {
    const seule = pass([node("F01", [0, 100])]);
    const out = consensusMerge([seule]);
    expect(out.analysis).toBe(seule);
    expect(out.variance.recoveredNodes).toBe(0);
    expect(out.variance.alignment).toBe("anchors");
  });

  it("rejette un jeu de passes vide", () => {
    expect(() => consensusMerge([])).toThrow(/aucune passe/);
  });
});
