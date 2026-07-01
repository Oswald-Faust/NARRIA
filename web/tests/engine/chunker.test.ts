import { describe, it, expect } from "vitest";
import { estimateTokens, needsChunking, chunkText, mergePartialGraphs, CHUNK_THRESHOLD_TOKENS } from "@/lib/engine/extraction/chunker";
import type { LlmAnalysis } from "@/lib/engine/extraction/llm-schema";

function makeAnalysis(overrides: Partial<LlmAnalysis> & { nodes: LlmAnalysis["nodes"] }): LlmAnalysis {
  return {
    summary: overrides.summary ?? "Résumé.",
    genre: overrides.genre ?? "Genre",
    tradition: overrides.tradition ?? "Classique occidentale",
    formal_features: overrides.formal_features ?? {
      form: "prose", register: "narratif_neutre", narrative_length_category: "court",
      approximate_word_count: 100, has_explicit_morality: false,
      has_narrator_intervention: false, uses_dialogue: false, stylistic_signature: "Sobre.",
    },
    main_actants_v1: overrides.main_actants_v1 ?? { _focus: "agent_actif", _description: "d", protagoniste: "A", objet: "O", destinateur: "D", destinataire: "R", adjuvant: "Adj", opposant: "Opp" },
    main_actants_v2: overrides.main_actants_v2 ?? { _focus: "patient_central", _description: "d", protagoniste: "A", objet: "O", destinateur: "D", destinataire: "R", adjuvant: "Adj", opposant: "Opp" },
    thematic_keywords: overrides.thematic_keywords ?? ["thème"],
    nodes: overrides.nodes,
  };
}

describe("estimateTokens / needsChunking", () => {
  it("estime ~1.2 token par 4 caractères", () => {
    const text = "a".repeat(4000);
    expect(estimateTokens(text)).toBe(Math.floor((4000 / 4) * 1.2));
  });

  it("ne nécessite pas de chunking sous le seuil", () => {
    expect(needsChunking("texte court")).toBe(false);
  });

  it("nécessite un chunking au-delà du seuil", () => {
    const bigText = "mot ".repeat(CHUNK_THRESHOLD_TOKENS);
    expect(needsChunking(bigText)).toBe(true);
  });
});

describe("chunkText", () => {
  it("retourne un seul bloc pour un texte court", () => {
    const chunks = chunkText("Paragraphe unique.\n\nDeuxième paragraphe.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].hasOverlapBefore).toBe(false);
    expect(chunks[0].hasOverlapAfter).toBe(false);
  });

  it("découpe un texte long en plusieurs blocs avec chevauchement", () => {
    const paragraphs = Array.from({ length: 200 }, (_, i) => `Paragraphe numéro ${i} avec un peu de texte pour occuper de la place.`);
    const bigText = paragraphs.join("\n\n");
    const chunks = chunkText(bigText, 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].hasOverlapAfter).toBe(true);
    expect(chunks[chunks.length - 1].hasOverlapBefore).toBe(true);
  });
});

describe("mergePartialGraphs", () => {
  it("retourne le résultat unique tel quel avec merge_info à 1 chunk", () => {
    const only = makeAnalysis({ nodes: [{ sequence: 1, function_code: "F01", function_name: "Départ", function_family: "Rupture initiale", actants: ["A"], modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 }, tension: 0.2, phase: "Exposition", text_excerpt: "…", justification: "…" }] });
    const chunks = chunkText(only.summary);
    const merged = mergePartialGraphs([only], chunks);
    expect(merged.analysis.nodes).toHaveLength(1);
    expect(merged.mergeInfo.nChunks).toBe(1);
  });

  it("fusionne et déduplique les nœuds similaires en zone de recouvrement", () => {
    const node = (seq: number, excerpt: string) => ({
      sequence: seq, function_code: "F10", function_name: "Rencontre", function_family: "Quête et cheminement",
      actants: ["Roméo", "Juliette"], modalities: { vouloir: 0.8, devoir: 0.1, pouvoir: 0.4, savoir: 0.3 },
      tension: 0.3, phase: "Exposition", text_excerpt: excerpt, justification: "…",
    });
    const partA = makeAnalysis({ nodes: [node(1, "Roméo aperçoit Juliette au bal masqué chez les Capulet")] });
    const partB = makeAnalysis({ nodes: [node(1, "Roméo aperçoit Juliette au bal masqué chez les Capulet ce soir-là"), { ...node(2, "Ils échangent leurs premiers mots dans le jardin"), function_code: "F50", function_name: "Amour" }] });
    const twoChunks = [
      { index: 0, totalChunks: 2, text: "", charStart: 0, charEnd: 1, estimatedTokens: 1, hasOverlapBefore: false, hasOverlapAfter: true },
      { index: 1, totalChunks: 2, text: "", charStart: 1, charEnd: 2, estimatedTokens: 1, hasOverlapBefore: true, hasOverlapAfter: false },
    ];
    const merged = mergePartialGraphs([partA, partB], twoChunks);
    expect(merged.analysis.nodes.length).toBe(2);
    expect(merged.mergeInfo.nDuplicatesRemoved).toBe(1);
    expect(merged.analysis.nodes.map((n) => n.sequence)).toEqual([1, 2]);
  });
});
