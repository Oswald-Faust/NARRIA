/**
 * Intégration du découpage déterministe à l'extraction : le prompt porte les
 * blocs, et les nœuds retournés par le modèle sont ancrés sur des coordonnées
 * textuelles vérifiables.
 */
import { describe, it, expect, afterEach } from "vitest";
import { buildUserPrompt } from "@/lib/engine/extraction/llm-prompts";
import { splitIntoBlocks, toJsonBlocks } from "@/lib/engine/segmentation/block-splitter";
import {
  anchorNodesToBlocks,
  blockSplittingEnabled,
  blockPromptExpansion,
} from "@/lib/engine/extraction/llm-extractor";
import type { LlmAnalysis, LlmNode } from "@/lib/engine/extraction/llm-schema";

const CORPUS = [
  "Jean poussa la porte de l'auberge.",
  "",
  "— Qui va là ? cria l'aubergiste.",
  "— Un voyageur, dit Jean.",
  "",
  "L'aubergiste servit la soupe. Le lendemain, Jean reprit la route.",
].join("\n");

function node(overrides: Partial<LlmNode>): LlmNode {
  return {
    sequence: 1,
    function_code: "F10",
    function_name: "Rencontre",
    function_family: "Quête et cheminement",
    actants: ["Jean", "L'aubergiste"],
    modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
    tension: 0.3,
    phase: "Exposition",
    text_excerpt: "Jean poussa la porte",
    justification: "Premier contact",
    ...overrides,
  };
}

function analysis(nodes: LlmNode[]): LlmAnalysis {
  return {
    summary: "",
    genre: "",
    tradition: "",
    formal_features: {
      form: "prose",
      register: "narratif_neutre",
      narrative_length_category: "tres_court",
      approximate_word_count: 30,
      has_explicit_morality: false,
      has_narrator_intervention: false,
      uses_dialogue: true,
      stylistic_signature: "",
    },
    nodes,
    main_actants_v1: {
      _focus: "agent_actif", _description: "", protagoniste: "Jean", objet: "",
      destinateur: "", destinataire: "", adjuvant: "", opposant: "",
    },
    main_actants_v2: {
      _focus: "patient_central", _description: "", protagoniste: "Jean", objet: "",
      destinateur: "", destinataire: "", adjuvant: "", opposant: "",
    },
    thematic_keywords: [],
  };
}

describe("Prompt ancré sur les blocs", () => {
  const blocks = splitIntoBlocks(CORPUS);
  const prompt = buildUserPrompt(CORPUS, {}, toJsonBlocks(blocks));

  it("présente le texte découpé et numéroté", () => {
    expect(prompt).toContain("<texte_decoupe>");
    expect(prompt).toContain("[1] Jean poussa la porte de l'auberge.");
    expect(prompt).toContain("[2] — Qui va là ? cria l'aubergiste.");
    expect(prompt).toContain(`découpé en ${blocks.length} blocs numérotés`);
  });

  it("énonce les quatre règles comme déjà appliquées", () => {
    for (const regle of [
      "Règle du Dialogue",
      "Règle du Paragraphe",
      "Règle du Saut Temporel",
      "Règle de Non-Fusion",
    ]) {
      expect(prompt).toContain(regle);
    }
    expect(prompt).toContain("DÉJÀ EFFECTUÉ, NON NÉGOCIABLE");
    expect(prompt).toContain("Tu ne redécoupes rien.");
  });

  it("demande l'ancrage par plage de blocs", () => {
    expect(prompt).toContain("block_start");
    expect(prompt).toContain("block_end");
    expect(prompt).toContain("La plage de blocs recouverte");
  });

  it("interdit la recopie des repères dans les citations", () => {
    expect(prompt).toContain("Ne les recopie jamais dans `text_excerpt`");
  });

  it("retombe sur le prompt historique sans blocs", () => {
    const nu = buildUserPrompt(CORPUS, {});
    expect(nu).toContain("<texte>");
    expect(nu).not.toContain("<texte_decoupe>");
    expect(nu).not.toContain("block_start");
  });

  it("conserve les métadonnées de titre et d'auteur", () => {
    const avecMeta = buildUserPrompt(CORPUS, { title: "L'Auberge", author: "Anonyme" }, toJsonBlocks(blocks));
    expect(avecMeta).toContain("Titre : L'Auberge");
    expect(avecMeta).toContain("Auteur : Anonyme");
  });
});

describe("anchorNodesToBlocks", () => {
  const blocks = splitIntoBlocks(CORPUS);

  it("convertit une plage de blocs en bornes de caractères exactes", () => {
    const result = anchorNodesToBlocks(
      analysis([node({ block_start: 2, block_end: 3 })]),
      blocks,
    );
    const ancre = result.nodes[0];
    expect(ancre._char_start).toBeDefined();
    expect(CORPUS.slice(ancre._char_start!, ancre._char_end!)).toBe(
      "— Qui va là ? cria l'aubergiste.\n— Un voyageur, dit Jean.",
    );
  });

  it("complète block_end quand le nœud tient dans un seul bloc", () => {
    const result = anchorNodesToBlocks(analysis([node({ block_start: 1 })]), blocks);
    expect(result.nodes[0]._char_start).toBe(0);
    expect(CORPUS.slice(result.nodes[0]._char_start!, result.nodes[0]._char_end!)).toBe(
      "Jean poussa la porte de l'auberge.",
    );
  });

  it("redresse une plage inversée", () => {
    const result = anchorNodesToBlocks(
      analysis([node({ block_start: 3, block_end: 2 })]),
      blocks,
    );
    expect(result.nodes[0].block_start).toBe(2);
    expect(result.nodes[0].block_end).toBe(3);
  });

  it("ignore un ancrage hors champ sans faire échouer l'analyse", () => {
    const result = anchorNodesToBlocks(
      analysis([node({ block_start: 999, block_end: 1000 })]),
      blocks,
    );
    expect(result.nodes[0]._char_start).toBeUndefined();
    expect(result.nodes).toHaveLength(1);
  });

  it("laisse intacte une analyse sans ancrage", () => {
    const nu = analysis([node({})]);
    expect(anchorNodesToBlocks(nu, blocks)).toBe(nu);
  });

  it("ne fait rien sans blocs", () => {
    const nu = analysis([node({ block_start: 1 })]);
    expect(anchorNodesToBlocks(nu, [])).toBe(nu);
  });
});

describe("blockPromptExpansion", () => {
  it("mesure le surcoût des repères ajoutés au prompt", () => {
    const expansion = blockPromptExpansion(CORPUS);
    expect(expansion).toBeGreaterThan(1);
    expect(expansion).toBeLessThan(2);
  });

  it("croît avec la densité de blocs", () => {
    const dialogue = ["— Oui.", "— Non.", "— Peut-être.", "— Jamais."].join("\n");
    const prose = "Le voyageur gravit la colline sans se retourner une seule fois vers la vallée qu'il quittait pour toujours.";
    expect(blockPromptExpansion(dialogue)).toBeGreaterThan(blockPromptExpansion(prose));
  });

  it("vaut 1 sur un texte vide ou quand le découpage est inactif", () => {
    expect(blockPromptExpansion("")).toBe(1);
    const initial = process.env.NARRIA_BLOCK_SPLIT;
    process.env.NARRIA_BLOCK_SPLIT = "off";
    expect(blockPromptExpansion(CORPUS)).toBe(1);
    if (initial === undefined) delete process.env.NARRIA_BLOCK_SPLIT;
    else process.env.NARRIA_BLOCK_SPLIT = initial;
  });
});

describe("Interrupteur d'environnement", () => {
  const initial = process.env.NARRIA_BLOCK_SPLIT;

  afterEach(() => {
    if (initial === undefined) delete process.env.NARRIA_BLOCK_SPLIT;
    else process.env.NARRIA_BLOCK_SPLIT = initial;
  });

  it("est actif par défaut", () => {
    delete process.env.NARRIA_BLOCK_SPLIT;
    expect(blockSplittingEnabled()).toBe(true);
  });

  it("se désactive par NARRIA_BLOCK_SPLIT=off, quelle que soit la casse", () => {
    process.env.NARRIA_BLOCK_SPLIT = "off";
    expect(blockSplittingEnabled()).toBe(false);
    process.env.NARRIA_BLOCK_SPLIT = "OFF";
    expect(blockSplittingEnabled()).toBe(false);
  });
});
