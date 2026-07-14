import type { NarrativeGraph } from "@/lib/engine";
import { tensionProfile } from "@/lib/engine";

/**
 * Extrait les infos par-œuvre nécessaires au rapport de comparaison
 * (sections « Œuvres comparées » et « Analyse LLM »).
 *
 * Partagé entre `/api/compare` (comparaison finale) et `/api/compare/analyze`
 * (analyse individuelle d'une colonne, réutilisée ensuite par la comparaison).
 */
export function buildWork(g: NarrativeGraph, costUsd: number) {
  const meta = g.metadata as Record<string, unknown>;
  const actants = meta.main_actants_v1 as
    | { protagoniste?: string; objet?: string; destinateur?: string; destinataire?: string; adjuvant?: string; opposant?: string }
    | undefined;
  return {
    title: String(meta.title ?? "Œuvre"),
    author: String(meta.author ?? "Auteur inconnu"),
    graphId: g.graphId,
    nNodes: g.nodes.length,
    nEdges: g.edges.length,
    tensionProfile: tensionProfile(g),
    summary: typeof meta.summary === "string" ? meta.summary : "",
    genre: typeof meta.genre === "string" ? meta.genre : "",
    tradition: typeof meta.tradition === "string" ? meta.tradition : "",
    thematicKeywords: Array.isArray(meta.thematicKeywords) ? (meta.thematicKeywords as string[]) : [],
    mainActants: actants
      ? {
          protagoniste: actants.protagoniste ?? "",
          objet: actants.objet ?? "",
          destinateur: actants.destinateur ?? "",
          destinataire: actants.destinataire ?? "",
          adjuvant: actants.adjuvant ?? "",
          opposant: actants.opposant ?? "",
        }
      : null,
    costUsd,
  };
}
