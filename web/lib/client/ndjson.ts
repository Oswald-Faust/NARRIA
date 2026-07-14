/**
 * Lecture d'un flux de réponse NDJSON (une valeur JSON par ligne), tel que produit par
 * /api/analyze, /api/compare et /api/compare/analyze.
 *
 * Retourne `true` si un événement terminal (`result` ou `error`) a été reçu, `false` si le
 * flux s'est terminé sans conclusion (utile pour détecter une interruption silencieuse).
 * Une exception de lecture (connexion coupée) est propagée à l'appelant.
 */
export interface NdjsonHandlers<T> {
  onProgress?: (p: { percent: number; message: string }) => void;
  onResult?: (data: T) => void;
  onError?: (error: string) => void;
}

export async function readNdjsonStream<T>(res: Response, handlers: NdjsonHandlers<T>): Promise<boolean> {
  const reader = res.body?.getReader();
  if (!reader) return false;

  const decoder = new TextDecoder();
  let buffer = "";
  let receivedOutcome = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "progress") {
          handlers.onProgress?.({ percent: parsed.percent, message: parsed.message });
        } else if (parsed.type === "result") {
          handlers.onResult?.(parsed.data as T);
          receivedOutcome = true;
        } else if (parsed.type === "error") {
          handlers.onError?.(parsed.error);
          receivedOutcome = true;
        }
      } catch {
        // Ligne NDJSON malformée : on l'ignore et on continue le flux.
        continue;
      }
    }
  }

  return receivedOutcome;
}
