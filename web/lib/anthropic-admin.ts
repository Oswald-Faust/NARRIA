/**
 * Client minimal de l'API Admin Anthropic (rapports d'usage & de coût).
 * Nécessite une clé Admin distincte (`ANTHROPIC_ADMIN_KEY`, préfixe
 * `sk-ant-admin…`). En son absence, toutes les fonctions renvoient `null` —
 * le dashboard bascule alors sur l'estimation interne.
 *
 * Réf. : https://docs.anthropic.com/en/api/administration-api
 */
const BASE = "https://api.anthropic.com/v1/organizations";

export function hasAdminKey(): boolean {
  return Boolean(process.env.ANTHROPIC_ADMIN_KEY);
}

function adminHeaders() {
  return {
    "x-api-key": process.env.ANTHROPIC_ADMIN_KEY as string,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

/** Coût total facturé (USD) sur les N derniers jours, ou null si indisponible. */
export async function fetchAnthropicCost(days = 30): Promise<{
  totalUsd: number;
  currency: string;
  startingAt: string;
} | null> {
  if (!hasAdminKey()) return null;
  try {
    const starting = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const url = `${BASE}/cost_report?starting_at=${starting}&group_by[]=description`;
    const res = await fetch(url, { headers: adminHeaders() });
    if (!res.ok) return null;
    const data = await res.json();

    let totalUsd = 0;
    let currency = "USD";
    for (const bucket of data?.data ?? []) {
      for (const item of bucket?.results ?? []) {
        const amount = Number(item?.amount ?? item?.cost ?? 0);
        if (!Number.isNaN(amount)) totalUsd += amount;
        if (item?.currency) currency = item.currency;
      }
    }
    return { totalUsd, currency, startingAt: starting };
  } catch (err) {
    console.error("[anthropic-admin] cost_report KO:", err);
    return null;
  }
}

/** Tokens cumulés (in/out) sur les N derniers jours, ou null si indisponible. */
export async function fetchAnthropicUsage(days = 30): Promise<{
  inputTokens: number;
  outputTokens: number;
} | null> {
  if (!hasAdminKey()) return null;
  try {
    const starting = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const url = `${BASE}/usage_report/messages?starting_at=${starting}`;
    const res = await fetch(url, { headers: adminHeaders() });
    if (!res.ok) return null;
    const data = await res.json();

    let inputTokens = 0;
    let outputTokens = 0;
    for (const bucket of data?.data ?? []) {
      for (const item of bucket?.results ?? []) {
        inputTokens += Number(item?.uncached_input_tokens ?? item?.input_tokens ?? 0) || 0;
        outputTokens += Number(item?.output_tokens ?? 0) || 0;
      }
    }
    return { inputTokens, outputTokens };
  } catch (err) {
    console.error("[anthropic-admin] usage_report KO:", err);
    return null;
  }
}
