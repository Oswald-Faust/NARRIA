import { z } from "zod";
import { sanitizeIdentityInference, sanitizeProseIdentityInference } from "./identity-filter";

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
  _cultural_correction: z.string().optional(),
  /**
   * Ancrage du nœud sur la plage de blocs produite par le découpage déterministe
   * (`segmentation/block-splitter.ts`). Le modèle ne décide plus des frontières :
   * il désigne l'intervalle de blocs que la fonction narrative recouvre. Facultatif,
   * pour rester compatible avec les analyses en cache antérieures au découpage par blocs.
   */
  block_start: z.number().int().positive().optional(),
  block_end: z.number().int().positive().optional(),
  /** Bornes de caractères déduites de la plage de blocs, calculées côté serveur. */
  _char_start: z.number().int().nonnegative().optional(),
  _char_end: z.number().int().nonnegative().optional(),
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
  cultural_corrections_note: z.string().optional(),
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

/**
 * Filtre de sortie anti-inférence identitaire (correctif P0-1, anomalie A8).
 * Appliqué AVANT `enforceCulturalRestriction` : la filiation textuelle qui
 * conditionne l'attribution des fonctions FN* ne doit jamais reposer sur une
 * spéculation quant à l'auteur. Si le seul indice avancé par le LLM était une
 * inférence sur la personne, le champ devient vide et le filet culturel
 * recode les FN* — comportement conservateur voulu.
 */
export function sanitizeAnalysisIdentity(data: LlmAnalysis): LlmAnalysis {
  const tradition = sanitizeIdentityInference(data.tradition);
  const summary = sanitizeProseIdentityInference(data.summary);
  const stylistic = sanitizeProseIdentityInference(
    typeof data.formal_features.stylistic_signature === "string" ? data.formal_features.stylistic_signature : "",
  );

  if (!tradition.removed.length && !summary.removed.length && !stylistic.removed.length) return data;

  console.warn(
    `[NARR'IA] Filtre identitaire : ${
      [...tradition.removed, ...summary.removed, ...stylistic.removed].length
    } segment(s) retiré(s) de l'analyse (inférence sur l'auteur).`,
  );

  return {
    ...data,
    tradition: tradition.value,
    summary: summary.value,
    formal_features: { ...data.formal_features, stylistic_signature: stylistic.value },
  };
}

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

  let correctionsCount = 0;

  const nodes = data.nodes.map((node) => {
    if (!node.function_code.startsWith("FN")) return node;
    const oldCode = node.function_code;
    const fallback = AFRICAN_TO_WESTERN_FALLBACK[oldCode] ?? ["F49", "Sentence morale"];
    correctionsCount += 1;
    return {
      ...node,
      function_code: fallback[0],
      function_name: fallback[1],
      _cultural_correction: data.tradition
        ? `Fonction ${oldCode} (africaine) recodée en ${fallback[0]} car la filiation textuelle relevée ('${data.tradition}') n'est pas afrodescendante`
        : `Fonction ${oldCode} (africaine) recodée en ${fallback[0]} : aucune filiation textuelle afrodescendante relevée dans le texte`,
    };
  });

  const result: LlmAnalysis = { ...data, nodes };

  if (correctionsCount > 0) {
    result.cultural_corrections_note =
      ` [Filet de sécurité culturelle : ${correctionsCount} fonction(s) africaine(s) recodée(s) en équivalent occidental car la filiation textuelle relevée n'est pas afrodescendante.]`.trim();
  }

  return result;
}
