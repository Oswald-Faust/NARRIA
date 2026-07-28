/**
 * Tests unitaires des modules introduits par les correctifs P1/P2 de la note
 * interne du 27/07/2026 : IDF fonctionnel, seuil de contenu, accord de genre,
 * baseline empirique et consensus d'extraction.
 */
import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_FUNCTION_IDF,
  buildFunctionIdf,
  nodeSpecificityWeight,
} from "@/lib/engine/comparison/function-idf";
import {
  canonicalizeActant,
  lexicalContentSimilarity,
  overlapCoefficient,
  tokenize,
  CONTENT_MATCH_THRESHOLD,
  contentSimilarity,
} from "@/lib/engine/comparison/content-similarity";
import { compareGenres, genreKey } from "@/lib/engine/comparison/genre";
import { evaluateAgainstBaseline } from "@/lib/engine/comparison/baseline";
import { consensusMerge } from "@/lib/engine/extraction/consensus";
import {
  attachNodeEmbeddings,
  cosineSimilarity,
  isEmbeddingProviderConfigured,
  nodeEmbeddingText,
  rescaleCosine,
} from "@/lib/engine/comparison/embeddings";
import type { NarrativeNode } from "@/lib/engine";
import type { LlmAnalysis, LlmNode } from "@/lib/engine/extraction/llm-schema";

describe("IDF fonctionnel (P1-4)", () => {
  it("une fonction rare pèse nettement plus qu'une fonction omniprésente", () => {
    const rare = DEFAULT_FUNCTION_IDF.weight("FNMALA");
    const banale = DEFAULT_FUNCTION_IDF.weight("F13");
    expect(rare / banale).toBeGreaterThan(8);
  });

  it("les fonctions citées comme quasi universelles par la note sont toutes sous-pondérées", () => {
    // A1 : « F13, F20, F22, F28, F31, F41… apparaissent dans presque tout récit ».
    for (const code of ["F13", "F20", "F22", "F28"]) {
      expect(DEFAULT_FUNCTION_IDF.weight(code)).toBeLessThan(0.5);
    }
  });

  it("une fonction inconnue reçoit le poids pivot, sans privilège ni pénalité", () => {
    expect(DEFAULT_FUNCTION_IDF.weight("F99")).toBeCloseTo(1, 6);
    expect(DEFAULT_FUNCTION_IDF.weight(null)).toBe(1);
  });

  it("accepte des fréquences observées sur corpus en remplacement des priors", () => {
    const custom = buildFunctionIdf({ F20: 0.02 });
    expect(custom.weight("F20")).toBeGreaterThan(DEFAULT_FUNCTION_IDF.weight("F20") * 5);
  });

  it("atténue la répétition d'une même fonction dans un même graphe", () => {
    const seul = nodeSpecificityWeight("F31", 1);
    const repete = nodeSpecificityWeight("F31", 4);
    expect(repete).toBeCloseTo(seul / 2, 6);
  });
});

function node(overrides: Partial<NarrativeNode>): NarrativeNode {
  return {
    nodeId: "n001",
    segmentId: "seg_n001",
    functionCode: "F20",
    functionFamily: "Obstacles et conflits",
    functionName: "Combat",
    actants: [],
    modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
    tension: 0.6,
    phase: "Climax",
    textExcerpt: "",
    ...overrides,
  };
}

describe("Seuil de contenu (P1-5)", () => {
  it("rejette le cas exact décrit par la note : dragon contre terroriste, tous deux F20", () => {
    const dragon = node({
      actants: ["Kaelen", "le dragon Vharok"],
      textExcerpt: "Le duel contre Vharok embrase toute la caldeira.",
    });
    const terroriste = node({
      actants: ["Davis", "le porteur"],
      textExcerpt: "La neutralisation du porteur prend quatre secondes et ne fait aucun bruit.",
    });
    expect(lexicalContentSimilarity(dragon, terroriste)).toBeLessThan(CONTENT_MATCH_THRESHOLD);
  });

  it("retient une scène reprise quasi mot pour mot", () => {
    const a = node({ actants: ["Halim"], textExcerpt: "Halim recopie le corrigé trouvé dans le casier de Bintou." });
    const b = node({ actants: ["Halim"], textExcerpt: "Halim recopie le corrigé qu'il a trouvé dans le casier de Bintou." });
    expect(lexicalContentSimilarity(a, b)).toBeGreaterThan(0.8);
  });

  it("retient un appariement sur les seuls actants quand les extraits divergent", () => {
    const a = node({ actants: ["Madame Sow"], textExcerpt: "Elle annonce le barème." });
    const b = node({ actants: ["madame sow (opposant)"], textExcerpt: "Un silence tombe sur la classe." });
    expect(lexicalContentSimilarity(a, b)).toBeGreaterThanOrEqual(CONTENT_MATCH_THRESHOLD);
  });

  it("normalise les actants en forme canonique (P2-9)", () => {
    expect(canonicalizeActant("Roméo (sujet)")).toBe("romeo");
    expect(canonicalizeActant("  le Dragon Vharok  ")).toBe("dragon vharok");
    expect(canonicalizeActant("Roméo")).toBe(canonicalizeActant("roméo (objet de désir)"));
  });

  it("le coefficient de recouvrement est symétrique et borné", () => {
    const a = tokenize("le combat contre le dragon ancien");
    const b = tokenize("un dragon surgit du combat");
    expect(overlapCoefficient(a, b)).toBe(overlapCoefficient(b, a));
    expect(overlapCoefficient(a, new Set<string>())).toBe(0);
  });
});

describe("Accord de genre (P0-2 / P1-7)", () => {
  it("reconnaît deux libellés équivalents malgré des formulations différentes", () => {
    expect(compareGenres("quête initiatique", "récit de quête initiatique").sameGenre).toBe(true);
  });

  it("distingue le cas de la paire B des tests bêta", () => {
    expect(compareGenres("power fantasy shonen", "thriller existentiel").sameGenre).toBe(false);
  });

  it("reste indéterminé — donc prudent — quand un genre manque", () => {
    expect(compareGenres("", "thriller existentiel").sameGenre).toBeNull();
    expect(compareGenres("fable", "").sameGenre).toBeNull();
  });

  it("indexe les baselines sur une clé stable, insensible à l'ordre des mots", () => {
    expect(genreKey("quête initiatique")).toBe(genreKey("initiatique quête"));
  });
});

describe("Baseline empirique (P2-8)", () => {
  it("retourne null tant qu'aucune distribution n'est calibrée — plutôt qu'un chiffre inventé", () => {
    expect(evaluateAgainstBaseline("quete-initiatique", 0.6)).toBeNull();
  });

  it("refuse une distribution d'effectif insuffisant", () => {
    expect(evaluateAgainstBaseline("g", 0.6, { g: { n: 5, mean: 0.3, sd: 0.1 } })).toBeNull();
  });

  it("situe le score en écart-type et en percentile quand la distribution existe", () => {
    const out = evaluateAgainstBaseline("g", 0.6, { g: { n: 120, mean: 0.4, sd: 0.1 } });
    expect(out?.zScore).toBeCloseTo(2, 6);
    expect(out?.percentile).toBeGreaterThan(97);
    expect(out?.corpusSize).toBe(120);
  });
});

function llmNode(code: string, sequence: number): LlmNode {
  return {
    sequence,
    function_code: code,
    function_name: code,
    function_family: "—",
    actants: ["X"],
    modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
    tension: 0.5,
    phase: "Complication",
    text_excerpt: `extrait ${code}`,
    justification: "—",
  };
}

function pass(codes: string[]): LlmAnalysis {
  return {
    summary: "—", genre: "conte", tradition: "",
    formal_features: {
      form: "prose", register: "narratif_neutre", narrative_length_category: "moyen",
      approximate_word_count: 900, has_explicit_morality: false,
      has_narrator_intervention: false, uses_dialogue: false, stylistic_signature: "—",
    },
    nodes: codes.map((c, i) => llmNode(c, i + 1)),
    main_actants_v1: { _focus: "a", _description: "—", protagoniste: "X", objet: "Y", destinateur: "—", destinataire: "—", adjuvant: "—", opposant: "—" },
    main_actants_v2: { _focus: "b", _description: "—", protagoniste: "Y", objet: "X", destinateur: "—", destinataire: "—", adjuvant: "—", opposant: "—" },
    thematic_keywords: [],
  };
}

describe("Consensus d'extraction (P2-9)", () => {
  it("laisse une passe unique strictement inchangée", () => {
    const single = pass(["F01", "F13", "F41"]);
    const out = consensusMerge([single]);
    expect(out.analysis).toBe(single);
    expect(out.variance).toMatchObject({ passes: 1, nodeCountSd: 0, agreementRatio: 1 });
  });

  it("écarte les nœuds qu'une seule passe sur trois a produits", () => {
    const out = consensusMerge([
      pass(["F01", "F13", "F28", "F41"]),
      pass(["F01", "F13", "F28", "F41"]),
      pass(["F01", "F13", "F22", "F28", "F41"]),
    ]);
    expect(out.analysis.nodes.map((n) => n.function_code)).toEqual(["F01", "F13", "F28", "F41"]);
    expect(out.variance.passes).toBe(3);
    expect(out.variance.nodeCounts).toEqual([4, 4, 5]);
  });

  it("mesure la variance inter-exécutions constatée par la note (35 puis 33 nœuds)", () => {
    const out = consensusMerge([pass(Array(35).fill("F13")), pass(Array(33).fill("F13"))]);
    expect(out.variance.nodeCountSd).toBeCloseTo(1, 6);
  });

  it("renumérote la séquence après élimination des nœuds isolés", () => {
    const out = consensusMerge([pass(["F01", "F13", "F41"]), pass(["F01", "F13", "F41"])]);
    expect(out.analysis.nodes.map((n) => n.sequence)).toEqual([1, 2, 3]);
  });
});

describe("Embeddings de nœuds (point 5 de la note)", () => {
  const withVec = (v: number[] | undefined, over: Partial<NarrativeNode> = {}) =>
    node({ ...over, ...(v ? { embedding: v } : {}) });

  it("le cosinus est neutre quand un vecteur manque, est vide ou n'a pas la même dimension", () => {
    expect(cosineSimilarity(undefined, [1, 0])).toBeNull();
    expect(cosineSimilarity([1, 0], [])).toBeNull();
    expect(cosineSimilarity([1, 0, 0], [1, 0])).toBeNull();
    expect(cosineSimilarity([0, 0], [1, 0])).toBeNull();
  });

  it("le cosinus vaut 1 pour deux vecteurs colinéaires", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it("le recalage ramène un cosinus de textes sans rapport à zéro", () => {
    // Un modèle d'embedding place deux textes français quelconques autour de 0,60.
    expect(rescaleCosine(0.6)).toBe(0);
    expect(rescaleCosine(0.45)).toBe(0);
    expect(rescaleCosine(0.9)).toBe(1);
    expect(rescaleCosine(0.75)).toBeCloseTo(0.5, 10);
  });

  it("la mesure par défaut se réduit exactement au lexical sans vecteurs", () => {
    const a = node({ textExcerpt: "Le duel contre Vharok embrase la caldeira.", actants: ["Kaelen"] });
    const b = node({ textExcerpt: "Davis neutralise le porteur sans bruit.", actants: ["Davis"] });
    expect(contentSimilarity(a, b)).toBe(lexicalContentSimilarity(a, b));
  });

  it("l'embedding rattrape une reformulation que le lexical manque", () => {
    // Vecteurs colinéaires : cosinus 1 → 1 après recalage, là où le lexical donne 0.
    const a = withVec([0.4, 0.6, 0.2], { textExcerpt: "Il quitte le hameau à l'aube.", actants: ["Kaelen"] });
    const b = withVec([0.8, 1.2, 0.4], { textExcerpt: "Le pâtre s'en va au petit matin.", actants: ["Orwen"] });
    expect(lexicalContentSimilarity(a, b)).toBeLessThan(CONTENT_MATCH_THRESHOLD);
    expect(contentSimilarity(a, b)).toBe(1);
  });

  it("prendre le maximum ne dégrade jamais la détection lexicale", () => {
    // Vecteurs orthogonaux (sémantique nulle) mais extraits quasi identiques.
    const a = withVec([1, 0], { textExcerpt: "Halim recopie le corrigé du casier de Bintou.", actants: ["Halim"] });
    const b = withVec([0, 1], { textExcerpt: "Halim recopie le corrigé trouvé dans le casier de Bintou.", actants: ["Halim"] });
    expect(contentSimilarity(a, b)).toBe(lexicalContentSimilarity(a, b));
    expect(contentSimilarity(a, b)).toBeGreaterThan(0.8);
  });

  it("le texte encodé reprend les deux signaux du proxy lexical", () => {
    const text = nodeEmbeddingText(node({ textExcerpt: "Le duel embrase la caldeira.", actants: ["Kaelen", "Vharok"] }));
    expect(text).toContain("Le duel embrase la caldeira.");
    expect(text).toContain("Kaelen, Vharok");
  });

  it("n'appelle aucun fournisseur et ne modifie rien sans clé configurée", async () => {
    const previous = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    try {
      expect(isEmbeddingProviderConfigured()).toBe(false);
      const nodes = [node({ textExcerpt: "Un extrait." })];
      await expect(attachNodeEmbeddings(nodes)).resolves.toBe(nodes);
    } finally {
      if (previous !== undefined) process.env.VOYAGE_API_KEY = previous;
    }
  });

  it("retombe sur les nœuds bruts si le fournisseur échoue — l'analyse ne casse pas", async () => {
    const previous = process.env.VOYAGE_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500, statusText: "Internal Server Error" }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.VOYAGE_API_KEY = "clé-de-test";
    try {
      const nodes = [node({ textExcerpt: "Un extrait." })];
      const out = await attachNodeEmbeddings(nodes);
      expect(out).toBe(nodes);
      expect(out[0].embedding).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      warnSpy.mockRestore();
      if (previous === undefined) delete process.env.VOYAGE_API_KEY;
      else process.env.VOYAGE_API_KEY = previous;
    }
  });

  it("attache les vecteurs renvoyés, en réordonnant sur l'index", async () => {
    const previous = process.env.VOYAGE_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: [
          { index: 1, embedding: [0.5, 0.5] },
          { index: 0, embedding: [0.123456, 0.9] },
        ],
      }),
    );
    process.env.VOYAGE_API_KEY = "clé-de-test";
    try {
      const out = await attachNodeEmbeddings([
        node({ nodeId: "n001", textExcerpt: "Premier." }),
        node({ nodeId: "n002", textExcerpt: "Second." }),
      ]);
      expect(out[0].embedding).toEqual([0.1235, 0.9]);
      expect(out[1].embedding).toEqual([0.5, 0.5]);
    } finally {
      fetchSpy.mockRestore();
      if (previous === undefined) delete process.env.VOYAGE_API_KEY;
      else process.env.VOYAGE_API_KEY = previous;
    }
  });
});
