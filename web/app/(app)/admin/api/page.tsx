"use client";

import { useEffect, useState } from "react";
import { KeyRound, Eye, EyeOff, Copy, Check, Coins, Cpu, Activity, CloudCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/stat-card";
import { formatUsd } from "@/lib/pricing";

interface Spend { requests: number; tokens: number; cost: number }
interface ApiData {
  key: { configured: boolean; masked: string; prefix: string; last4: string; lengthValid: boolean };
  adminApi: { configured: boolean };
  spend: { all: Spend; last30d: Spend; last7d: Spend; last24h: Spend };
  byModel: { model: string; requests: number; tokens: number; inputTokens: number; outputTokens: number; cost: number }[];
  anthropic: { available: boolean; costUsd: number | null; currency: string; inputTokens: number | null; outputTokens: number | null; startingAt: string | null };
  recentRequests: { id: string; email: string; model: string; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; success: boolean; createdAt: string }[];
}

const nf = new Intl.NumberFormat("fr-FR");
const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminApiPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/api")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  async function toggleReveal() {
    if (revealed) { setRevealed(null); return; }
    const r = await fetch("/api/admin/api/reveal", { method: "POST" });
    if (r.ok) { const d = await r.json(); setRevealed(d.key); }
  }

  async function copyKey() {
    const r = await fetch("/api/admin/api/reveal", { method: "POST" });
    if (!r.ok) return;
    const d = await r.json();
    await navigator.clipboard.writeText(d.key).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <Card>Chargement…</Card>;
  if (!data) return <Card>Impossible de charger les données API.</Card>;

  return (
    <div className="space-y-6">
      {/* Carte clé API */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-purple/15 text-soft-purple">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-sm font-bold text-foreground">Clé API Anthropic</p>
              <p className="mt-0.5 flex items-center gap-2">
                {data.key.configured ? (
                  <Badge tone={data.key.lengthValid ? "success" : "yellow"}>{data.key.lengthValid ? "Configurée" : "Format douteux"}</Badge>
                ) : (
                  <Badge tone="danger">Absente</Badge>
                )}
              </p>
            </div>
          </div>
          {data.key.configured && (
            <div className="flex items-center gap-2">
              <button onClick={toggleReveal} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-foreground">
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {revealed ? "Masquer" : "Révéler"}
              </button>
              <button onClick={copyKey} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-foreground">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? "Copiée" : "Copier"}
              </button>
            </div>
          )}
        </div>
        {data.key.configured && (
          <code className="mt-4 block break-all rounded-xl border border-border bg-surface-2 px-4 py-3 font-mono text-sm text-foreground">
            {revealed ?? data.key.masked}
          </code>
        )}
      </Card>

      {/* Dépenses estimées */}
      <div>
        <h3 className="mb-3 font-heading text-base font-bold text-foreground">Dépenses estimées (interne)</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Coins className="h-5 w-5" />} tone="amber" label="Total" value={formatUsd(data.spend.all.cost)} sub={`${nf.format(data.spend.all.requests)} requêtes`} />
          <StatCard icon={<Coins className="h-5 w-5" />} tone="purple" label="30 jours" value={formatUsd(data.spend.last30d.cost)} sub={`${nf.format(data.spend.last30d.tokens)} tokens`} />
          <StatCard icon={<Coins className="h-5 w-5" />} tone="pink" label="7 jours" value={formatUsd(data.spend.last7d.cost)} sub={`${nf.format(data.spend.last7d.requests)} requêtes`} />
          <StatCard icon={<Coins className="h-5 w-5" />} tone="emerald" label="24 heures" value={formatUsd(data.spend.last24h.cost)} sub={`${nf.format(data.spend.last24h.requests)} requêtes`} />
        </div>
      </div>

      {/* Réconciliation Anthropic */}
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400"><CloudCog className="h-5 w-5" /></span>
          <h3 className="font-heading text-base font-bold text-foreground">Facturation réelle Anthropic (API Admin)</h3>
        </div>
        {data.anthropic.available ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label={`Coût réel (depuis ${data.anthropic.startingAt})`} value={formatUsd(data.anthropic.costUsd ?? 0)} />
            <Field label="Tokens entrée" value={nf.format(data.anthropic.inputTokens ?? 0)} />
            <Field label="Tokens sortie" value={nf.format(data.anthropic.outputTokens ?? 0)} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {data.adminApi.configured
              ? "Clé Admin configurée mais l’API n’a renvoyé aucune donnée (vérifiez les droits de la clé)."
              : "Non configurée. Ajoutez une clé Admin Anthropic (ANTHROPIC_ADMIN_KEY, préfixe sk-ant-admin…) dans .env.local pour afficher les coûts de facturation réels."}
          </p>
        )}
      </Card>

      {/* Répartition par modèle */}
      {data.byModel.length > 0 && (
        <Card className="p-0">
          <h3 className="flex items-center gap-2 border-b border-border px-5 py-3 font-heading text-sm font-bold"><Cpu className="h-4 w-4 text-muted" /> Répartition par modèle</h3>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-2.5">Modèle</th><th className="px-5 py-2.5">Requêtes</th><th className="px-5 py-2.5">Tokens (in/out)</th><th className="px-5 py-2.5">Coût</th></tr>
            </thead>
            <tbody>
              {data.byModel.map((m) => (
                <tr key={m.model} className="border-b border-border/50 last:border-0">
                  <td className="px-5 py-2.5 font-mono text-xs text-foreground">{m.model}</td>
                  <td className="px-5 py-2.5 text-muted">{nf.format(m.requests)}</td>
                  <td className="px-5 py-2.5 text-muted">{nf.format(m.inputTokens)} / {nf.format(m.outputTokens)}</td>
                  <td className="px-5 py-2.5 text-muted">{formatUsd(m.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Log des requêtes */}
      <Card className="p-0">
        <h3 className="flex items-center gap-2 border-b border-border px-5 py-3 font-heading text-sm font-bold"><Activity className="h-4 w-4 text-muted" /> Requêtes récentes</h3>
        {data.recentRequests.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aucune requête IA enregistrée pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-5 py-2.5">Date</th><th className="px-5 py-2.5">Utilisateur</th><th className="px-5 py-2.5">Modèle</th><th className="px-5 py-2.5">Tokens</th><th className="px-5 py-2.5">Coût</th><th className="px-5 py-2.5">Statut</th></tr>
              </thead>
              <tbody>
                {data.recentRequests.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-2.5 text-muted">{fmt(r.createdAt)}</td>
                    <td className="px-5 py-2.5 text-foreground">{r.email}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-muted">{r.model}</td>
                    <td className="px-5 py-2.5 text-muted">{nf.format(r.totalTokens)}</td>
                    <td className="px-5 py-2.5 text-muted">{formatUsd(r.costUsd)}</td>
                    <td className="px-5 py-2.5">{r.success ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Échec</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
