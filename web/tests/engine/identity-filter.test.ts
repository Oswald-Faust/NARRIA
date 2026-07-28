/**
 * Filtre de sortie anti-inférence identitaire — correctif P0-1 de la note
 * interne du 27/07/2026 (anomalie A8).
 *
 * Les rapports bêta avaient produit « contexte guinéen présumé, auteur Halim »
 * et « auteur francophone non identifié comme afrodescendant ». Un outil
 * d'analyse structurale ne doit produire aucune spéculation sur l'origine,
 * l'appartenance ou l'identité d'un auteur.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeIdentityInference,
  sanitizeProseIdentityInference,
} from "@/lib/engine/extraction/identity-filter";
import { sanitizeAnalysisIdentity, enforceCulturalRestriction, type LlmAnalysis } from "@/lib/engine/extraction/llm-schema";

describe("sanitizeIdentityInference — champ « tradition »", () => {
  it("rejette les énoncés exacts constatés lors des tests bêta", () => {
    expect(sanitizeIdentityInference("contexte guinéen présumé, auteur Halim").value).toBe("");
    expect(sanitizeIdentityInference("auteur francophone non identifié comme afrodescendant").value).toBe("");
  });

  it("rejette toute assignation d'origine, d'ethnie ou d'appartenance", () => {
    for (const value of [
      "Africaine orale (auteur d'origine ivoirienne)",
      "Classique occidentale, autrice européenne",
      "Récit dont l'appartenance culturelle reste à déterminer",
      "Tradition probablement afrodescendante",
    ]) {
      const out = sanitizeIdentityInference(value);
      expect(out.removed.length).toBeGreaterThan(0);
      expect(out.value).not.toMatch(/auteur|autrice|origine|appartenance|probablement/i);
    }
  });

  it("conserve intacte une filiation décrite par les indices du texte", () => {
    for (const value of [
      "Africaine orale — récit à proverbes",
      "Classique occidentale",
      "Réalisme moderne",
      "Oralité mixte : conte encadré par une voix narrative",
    ]) {
      expect(sanitizeIdentityInference(value).value).toBe(value);
    }
  });

  it("ne retire que le segment incriminé, pas la valeur entière", () => {
    const out = sanitizeIdentityInference("Africaine orale, auteur guinéen présumé");
    expect(out.value).toBe("Africaine orale");
    expect(out.removed).toEqual(["auteur guinéen présumé"]);
  });
});

describe("sanitizeProseIdentityInference — résumé et signature stylistique", () => {
  it("retire la phrase qui qualifie l'auteur", () => {
    const out = sanitizeProseIdentityInference(
      "Un jeune homme quitte son village pour la ville. L'auteur est vraisemblablement d'origine guinéenne. Il y perd tout.",
    );
    expect(out.value).toBe("Un jeune homme quitte son village pour la ville. Il y perd tout.");
    expect(out.removed).toHaveLength(1);
  });

  it("ne mutile pas un résumé qui situe un PERSONNAGE — le texte parle de qui il veut", () => {
    const summary = "Fatou, guinéenne installée à Marseille, retrouve sa sœur après vingt ans.";
    expect(sanitizeProseIdentityInference(summary).value).toBe(summary);
  });
});

function analysisWith(overrides: Partial<LlmAnalysis>): LlmAnalysis {
  return {
    summary: "Résumé neutre.",
    genre: "conte",
    tradition: "Africaine orale",
    formal_features: {
      form: "prose",
      register: "narratif_neutre",
      narrative_length_category: "moyen",
      approximate_word_count: 1200,
      has_explicit_morality: true,
      has_narrator_intervention: true,
      uses_dialogue: true,
      stylistic_signature: "oral, sentencieux",
    },
    nodes: [
      {
        sequence: 1,
        function_code: "FNPROV",
        function_name: "Proverbe narratif",
        function_family: "Fonctions africaines",
        actants: ["le griot"],
        modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
        tension: 0.4,
        phase: "Exposition",
        text_excerpt: "Le vieux dit : la rivière ne remonte jamais sa source.",
        justification: "Sentence liminaire.",
      },
    ],
    main_actants_v1: {
      _focus: "agent_actif", _description: "—", protagoniste: "le griot", objet: "la mémoire",
      destinateur: "—", destinataire: "le village", adjuvant: "—", opposant: "—",
    },
    main_actants_v2: {
      _focus: "patient_central", _description: "—", protagoniste: "le village", objet: "la mémoire",
      destinateur: "—", destinataire: "le village", adjuvant: "—", opposant: "—",
    },
    thematic_keywords: ["mémoire"],
    ...overrides,
  };
}

describe("sanitizeAnalysisIdentity — intégration dans le pipeline d'extraction", () => {
  it("laisse intacte une analyse dont aucun champ ne spécule", () => {
    const input = analysisWith({});
    expect(sanitizeAnalysisIdentity(input)).toBe(input);
  });

  it("nettoie tradition, résumé et signature stylistique en une passe", () => {
    const out = sanitizeAnalysisIdentity(
      analysisWith({
        tradition: "Africaine orale, auteur présumé guinéen",
        summary: "Un conte de transmission. L'auteur est probablement afrodescendant.",
        formal_features: {
          ...analysisWith({}).formal_features,
          stylistic_signature: "Style oral. L'écrivain semble être originaire du Fouta-Djalon.",
        },
      }),
    );
    expect(out.tradition).toBe("Africaine orale");
    expect(out.summary).toBe("Un conte de transmission.");
    expect(out.formal_features.stylistic_signature).toBe("Style oral.");
  });

  it("conserve les fonctions FN* quand la filiation afrodescendante survit au filtre", () => {
    const out = enforceCulturalRestriction(
      sanitizeAnalysisIdentity(analysisWith({ tradition: "Africaine orale, auteur guinéen présumé" })),
    );
    expect(out.nodes[0].function_code).toBe("FNPROV");
  });

  it("recode les FN* quand la filiation ne reposait QUE sur une inférence relative à l'auteur", () => {
    // Comportement conservateur voulu : une fonction culturellement située ne peut
    // pas être attribuée sur la foi d'une spéculation quant à qui a écrit le texte.
    const out = enforceCulturalRestriction(
      sanitizeAnalysisIdentity(analysisWith({ tradition: "auteur guinéen présumé" })),
    );
    expect(out.nodes[0].function_code).toBe("F49");
    expect(out.nodes[0]._cultural_correction).toBeDefined();
    expect(out.nodes[0]._cultural_correction).not.toMatch(/auteur|guinéen|présumé/i);
  });
});
