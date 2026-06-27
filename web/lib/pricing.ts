/**
 * Tarifs publics de l'API Claude (USD par **million** de tokens).
 * Source : grille Anthropic. À ajuster si les tarifs évoluent.
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-8": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

const DEFAULT_PRICE: ModelPrice = MODEL_PRICING["claude-sonnet-4-6"];

export function priceFor(model: string): ModelPrice {
  return MODEL_PRICING[model] ?? DEFAULT_PRICE;
}

/** Coût estimé en USD d'une requête, en tenant compte des tokens en cache. */
export function estimateCostUsd(
  model: string,
  tokens: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number },
): number {
  const p = priceFor(model);
  const input = tokens.inputTokens ?? 0;
  const output = tokens.outputTokens ?? 0;
  const cached = tokens.cachedInputTokens ?? 0;
  const freshInput = Math.max(0, input - cached);
  return (freshInput * p.input + cached * p.cacheRead + output * p.output) / 1_000_000;
}

/** Formate un montant USD pour l'affichage (4 décimales sous 1 $, sinon 2). */
export function formatUsd(amount: number): string {
  const abs = Math.abs(amount);
  const digits = abs > 0 && abs < 1 ? 4 : 2;
  return `$${amount.toFixed(digits)}`;
}
