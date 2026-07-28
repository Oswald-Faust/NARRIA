/**
 * Embeddings de nœuds narratifs — volet sémantique du seuil de contenu
 * (point 5 de la note interne du 27/07/2026 : « une similarité minimale de
 * contenu — embeddings des extraits et des actants du nœud »).
 *
 * ARCHITECTURE. Le comparateur est synchrone et doit pouvoir tourner sur des
 * graphes rechargés depuis MongoDB, sans accès réseau. Les vecteurs sont donc
 * calculés UNE FOIS au moment de l'extraction et transportés dans le nœud
 * (`NarrativeNode.embedding`) ; la comparaison n'est plus qu'un produit scalaire.
 *
 * DÉGRADATION MAÎTRISÉE. Sans fournisseur configuré — ou en cas d'échec réseau —
 * aucun vecteur n'est produit et le moteur retombe sur le recouvrement lexical
 * de `content-similarity.ts`. L'analyse n'échoue jamais pour cette raison :
 * l'embedding améliore la mesure, il n'en est pas une condition.
 *
 * FOURNISSEUR. Voyage AI, appelé par `fetch` — aucune dépendance npm ajoutée.
 * Activation par la seule présence de `VOYAGE_API_KEY` dans l'environnement.
 */
import type { NarrativeNode } from "../models";

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";

/** Modèle et dimension : `voyage-3-lite` en 256 dimensions — assez fin pour
 *  discriminer deux scènes, assez compact pour être stocké avec le graphe. */
const VOYAGE_MODEL = process.env.VOYAGE_EMBEDDING_MODEL || "voyage-3-lite";
const EMBEDDING_DIMENSION = 256;

/** Voyage plafonne le nombre d'entrées par requête ; les graphes font au plus 35 nœuds. */
const BATCH_SIZE = 96;

/** Précision de stockage : 4 décimales suffisent au cosinus et divisent par ~2 le poids JSON. */
const STORAGE_PRECISION = 1e4;

export function isEmbeddingProviderConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

/**
 * Texte soumis à l'encodeur : ce que le nœud raconte, et qui le vit. Reprend
 * exactement les deux signaux du proxy lexical, pour que les deux mesures
 * portent sur la même matière.
 */
export function nodeEmbeddingText(node: NarrativeNode): string {
  const actants = node.actants?.length ? `Actants : ${node.actants.join(", ")}.` : "";
  const fonction = node.functionName ? `Fonction narrative : ${node.functionName}.` : "";
  return [node.textExcerpt ?? "", actants, fonction].filter(Boolean).join(" ").trim();
}

async function embedBatch(texts: string[], apiKey: string, signal?: AbortSignal): Promise<number[][]> {
  const response = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: "document",
      output_dimension: EMBEDDING_DIMENSION,
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Voyage a répondu ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { data?: Array<{ index: number; embedding: number[] }> };
  if (!Array.isArray(payload.data)) throw new Error("Réponse Voyage sans champ `data`.");
  // L'API ne garantit pas l'ordre : on réordonne sur `index`.
  const out: number[][] = new Array(texts.length);
  for (const item of payload.data) out[item.index] = item.embedding;
  if (out.some((v) => !Array.isArray(v))) throw new Error("Réponse Voyage incomplète.");
  return out;
}

function quantize(vector: number[]): number[] {
  return vector.map((v) => Math.round(v * STORAGE_PRECISION) / STORAGE_PRECISION);
}

/**
 * Enrichit les nœuds de leur vecteur sémantique. Ne lève jamais : en cas
 * d'absence de clé ou d'échec, retourne les nœuds inchangés et le moteur
 * retombe sur la mesure lexicale.
 */
export async function attachNodeEmbeddings(
  nodes: NarrativeNode[],
  options: { signal?: AbortSignal } = {},
): Promise<NarrativeNode[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey || nodes.length === 0) return nodes;

  const texts = nodes.map(nodeEmbeddingText);
  // Un nœud sans extrait ni actants n'a rien à encoder.
  if (texts.every((t) => !t)) return nodes;

  try {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE).map((t) => t || "—");
      vectors.push(...(await embedBatch(slice, apiKey, options.signal)));
    }
    return nodes.map((node, i) => (texts[i] ? { ...node, embedding: quantize(vectors[i]) } : node));
  } catch (err) {
    console.warn(
      `[NARR'IA] Embeddings indisponibles (${err instanceof Error ? err.message : String(err)}) — ` +
        "repli sur le recouvrement lexical pour le seuil de contenu.",
    );
    return nodes;
  }
}

/** Cosinus de deux vecteurs de même dimension ; `null` si l'un manque ou est nul. */
export function cosineSimilarity(a: number[] | undefined, b: number[] | undefined): number | null {
  if (!a?.length || !b?.length || a.length !== b.length) return null;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return null;
  return dot / Math.sqrt(normA * normB);
}

/**
 * Bornes de recalage du cosinus sur l'échelle du seuil de contenu.
 *
 * Un modèle d'embedding place deux textes français sans rapport autour de 0,60 :
 * la valeur brute n'est pas comparable à un taux de recouvrement lexical. On
 * ramène donc [FLOOR, CEILING] sur [0, 1], de sorte qu'un unique seuil
 * (`CONTENT_MATCH_THRESHOLD`) régisse les deux mesures.
 */
export const COSINE_FLOOR = 0.6;
export const COSINE_CEILING = 0.9;

export function rescaleCosine(cosine: number): number {
  return Math.min(1, Math.max(0, (cosine - COSINE_FLOOR) / (COSINE_CEILING - COSINE_FLOOR)));
}

/**
 * Similarité sémantique entre deux nœuds, sur l'échelle du seuil de contenu.
 * `null` si l'un des deux nœuds n'a pas été encodé.
 */
export function embeddingContentSimilarity(a: NarrativeNode, b: NarrativeNode): number | null {
  const cosine = cosineSimilarity(a.embedding, b.embedding);
  return cosine === null ? null : rescaleCosine(cosine);
}
