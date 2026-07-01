import { describe, it, expect } from "vitest";
import { LlmAnalysisSchema, enforceCulturalRestriction } from "@/lib/engine/extraction/llm-schema";

const VALID_PAYLOAD = {
  summary: "Un corbeau se fait duper par un renard flatteur.",
  genre: "Fable apologue",
  tradition: "Classique gréco-latine (fable ésopique)",
  formal_features: {
    form: "prose",
    register: "narratif_neutre",
    narrative_length_category: "tres_court",
    approximate_word_count: 120,
    has_explicit_morality: true,
    has_narrator_intervention: false,
    uses_dialogue: false,
    stylistic_signature: "Sobre et ironique.",
  },
  nodes: [
    {
      sequence: 1,
      function_code: "F49",
      function_name: "Sentence morale",
      function_family: "Résolution",
      actants: ["Renard (sujet)", "Corbeau (objet)"],
      modalities: { vouloir: 0.8, devoir: 0.1, pouvoir: 0.6, savoir: 0.7 },
      tension: 0.5,
      phase: "Résolution",
      text_excerpt: "Apprenez que tout flatteur vit aux dépens de celui qui l'écoute.",
      justification: "Moralité finale explicite.",
    },
  ],
  main_actants_v1: {
    _focus: "agent_actif",
    _description: "Le sujet est l'agent qui conduit l'action.",
    protagoniste: "Renard",
    objet: "Fromage",
    destinateur: "Faim",
    destinataire: "Renard lui-même",
    adjuvant: "Ruse",
    opposant: "Méfiance du corbeau",
  },
  main_actants_v2: {
    _focus: "patient_central",
    _description: "Le sujet subit l'action.",
    protagoniste: "Corbeau",
    objet: "Garder le fromage",
    destinateur: "Vanité",
    destinataire: "Corbeau lui-même",
    adjuvant: "Position en hauteur",
    opposant: "Flatterie du renard",
  },
  thematic_keywords: ["vanité", "flatterie", "ruse"],
};

describe("LlmAnalysisSchema", () => {
  it("accepte un payload conforme", () => {
    const parsed = LlmAnalysisSchema.parse(VALID_PAYLOAD);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].function_code).toBe("F49");
  });

  it("rejette un payload sans nodes", () => {
    const { nodes: _nodes, ...invalid } = VALID_PAYLOAD;
    expect(() => LlmAnalysisSchema.parse(invalid)).toThrow();
  });

  it("rejette une modalité hors [0,1]", () => {
    const invalid = {
      ...VALID_PAYLOAD,
      nodes: [{ ...VALID_PAYLOAD.nodes[0], modalities: { vouloir: 1.5, devoir: 0.1, pouvoir: 0.6, savoir: 0.7 } }],
    };
    expect(() => LlmAnalysisSchema.parse(invalid)).toThrow();
  });
});

describe("enforceCulturalRestriction", () => {
  it("laisse passer les fonctions FN* pour une tradition africaine", () => {
    const data = { ...VALID_PAYLOAD, tradition: "Africaine orale (contes peuls)", nodes: [{ ...VALID_PAYLOAD.nodes[0], function_code: "FNPROV", function_name: "Proverbe narratif" }] };
    const parsed = LlmAnalysisSchema.parse(data);
    const result = enforceCulturalRestriction(parsed);
    expect(result.nodes[0].function_code).toBe("FNPROV");
  });

  it("recode une fonction FN* vers son équivalent occidental pour une tradition non africaine", () => {
    const data = { ...VALID_PAYLOAD, tradition: "Classique gréco-latine (fable ésopique)", nodes: [{ ...VALID_PAYLOAD.nodes[0], function_code: "FNPROV", function_name: "Proverbe narratif" }] };
    const parsed = LlmAnalysisSchema.parse(data);
    const result = enforceCulturalRestriction(parsed);
    expect(result.nodes[0].function_code).toBe("F49");
    expect(result.nodes[0].function_name).toBe("Sentence morale");
  });

  it("ajoute _cultural_correction sur le nœud recodé et cultural_corrections_note global", () => {
    const data = { ...VALID_PAYLOAD, tradition: "Classique gréco-latine (fable ésopique)", nodes: [{ ...VALID_PAYLOAD.nodes[0], function_code: "FNBENI", function_name: "Bénédiction" }] };
    const parsed = LlmAnalysisSchema.parse(data);
    const result = enforceCulturalRestriction(parsed);
    expect(result.nodes[0]._cultural_correction).toContain("FNBENI");
    expect(result.nodes[0]._cultural_correction).toContain("F11");
    expect(result.cultural_corrections_note).toContain("1 fonction");
  });

  it("ne définit pas cultural_corrections_note si aucune correction n'a eu lieu", () => {
    const data = { ...VALID_PAYLOAD, tradition: "Classique gréco-latine (fable ésopique)" };
    const parsed = LlmAnalysisSchema.parse(data);
    const result = enforceCulturalRestriction(parsed);
    expect(result.cultural_corrections_note).toBeUndefined();
  });
});
