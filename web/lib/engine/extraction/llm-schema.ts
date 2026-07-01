import { z } from "zod";

const ModalitiesSchema = z.object({
  vouloir: z.number().min(0).max(1),
  devoir: z.number().min(0).max(1),
  pouvoir: z.number().min(0).max(1),
  savoir: z.number().min(0).max(1),
});

const LlmNodeSchema = z.object({
  sequence: z.number().int().positive(),
  function_code: z.string(),
  function_name: z.string(),
  function_family: z.string(),
  actants: z.array(z.string()),
  modalities: ModalitiesSchema,
  tension: z.number().min(0).max(1),
  phase: z.string(),
  text_excerpt: z.string(),
  justification: z.string(),
});

const ActantConfigSchema = z.object({
  _focus: z.string(),
  _description: z.string(),
  protagoniste: z.string(),
  objet: z.string(),
  destinateur: z.string(),
  destinataire: z.string(),
  adjuvant: z.string(),
  opposant: z.string(),
});

const FormalFeaturesSchema = z.object({
  form: z.string(),
  register: z.string(),
  narrative_length_category: z.string(),
  approximate_word_count: z.number().int().nonnegative(),
  has_explicit_morality: z.boolean(),
  has_narrator_intervention: z.boolean(),
  uses_dialogue: z.boolean(),
  stylistic_signature: z.string(),
});

export const LlmAnalysisSchema = z.object({
  summary: z.string(),
  genre: z.string(),
  tradition: z.string(),
  formal_features: FormalFeaturesSchema,
  nodes: z.array(LlmNodeSchema),
  main_actants_v1: ActantConfigSchema,
  main_actants_v2: ActantConfigSchema,
  thematic_keywords: z.array(z.string()),
});

export type LlmAnalysis = z.infer<typeof LlmAnalysisSchema>;
export type LlmNode = z.infer<typeof LlmNodeSchema>;

/** Mapping des fonctions africaines vers leur équivalent occidental (port de AFRICAN_TO_WESTERN_FALLBACK). */
const AFRICAN_TO_WESTERN_FALLBACK: Record<string, [string, string]> = {
  FNPROV: ["F49", "Sentence morale"],
  FNBENI: ["F11", "Don / Réception"],
  FNMALA: ["F47", "Punition"],
  FNANC: ["F31", "Révélation"],
  FNGR: ["F32", "Dissimulation"],
  FNAL: ["F51", "Union"],
  FNCOMM: ["F49", "Sentence morale"],
};

function isAfrodescendantTradition(tradition: string): boolean {
  const t = tradition.trim().toLowerCase();
  return (
    t.startsWith("africain") ||
    t.startsWith("afro") ||
    t.includes("afrique") ||
    t.includes("caribéen") ||
    t.includes("afrodescendant")
  );
}

/**
 * Filet de sécurité : retire les fonctions FN* attribuées à tort à une œuvre non
 * afrodescendante, et les remplace par leur équivalent occidental le plus proche.
 * Port de `_enforce_cultural_restriction`.
 */
export function enforceCulturalRestriction(data: LlmAnalysis): LlmAnalysis {
  if (isAfrodescendantTradition(data.tradition)) return data;

  const nodes = data.nodes.map((node) => {
    if (!node.function_code.startsWith("FN")) return node;
    const fallback = AFRICAN_TO_WESTERN_FALLBACK[node.function_code] ?? ["F49", "Sentence morale"];
    return { ...node, function_code: fallback[0], function_name: fallback[1] };
  });

  return { ...data, nodes };
}
