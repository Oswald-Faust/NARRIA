"use client";

import { useEffect, useState } from "react";
import {
  Users, ScanText, GitCompareArrows, MessageSquareText, Coins, Cpu, LogIn, ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingBlock } from "@/components/ui/spinner";
import { StatCard } from "@/components/admin/stat-card";
import { ActivityChart, type SeriesPoint } from "@/components/admin/bar-chart";
import { formatUsd } from "@/lib/pricing";

interface Overview {
  users: { total: number; admins: number; verified: number; active: number; new7d: number; new30d: number };
  analyses: { total: number; last7d: number };
  comparisons: { total: number; last7d: number };
  ai: { requests: number; tokens: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  logins: { last24h: number; failed7d: number };
  series: { analyses: SeriesPoint[]; comparisons: SeriesPoint[]; chat: SeriesPoint[] };
}

const nf = new Intl.NumberFormat("fr-FR");

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingBlock />;
  if (!data) return <Card>Impossible de charger les statistiques.</Card>;

  return (
    <div className="space-y-6">
      {/* KPIs principaux */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} tone="purple" label="Utilisateurs"
          value={nf.format(data.users.total)}
          sub={`${data.users.active} actifs · +${data.users.new7d} cette semaine`} />
        <StatCard icon={<ScanText className="h-5 w-5" />} tone="sky" label="Analyses"
          value={nf.format(data.analyses.total)} sub={`+${data.analyses.last7d} sur 7 j`} />
        <StatCard icon={<GitCompareArrows className="h-5 w-5" />} tone="pink" label="Comparaisons"
          value={nf.format(data.comparisons.total)} sub={`+${data.comparisons.last7d} sur 7 j`} />
        <StatCard icon={<MessageSquareText className="h-5 w-5" />} tone="emerald" label="Requêtes IA"
          value={nf.format(data.ai.requests)} sub={`${nf.format(data.ai.tokens)} tokens cumulés`} />
      </div>

      {/* KPIs secondaires */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Coins className="h-5 w-5" />} tone="amber" label="Coût IA estimé"
          value={formatUsd(data.ai.estimatedCostUsd)} sub="depuis le début" />
        <StatCard icon={<Cpu className="h-5 w-5" />} tone="purple" label="Tokens (in / out)"
          value={`${nf.format(data.ai.inputTokens)} / ${nf.format(data.ai.outputTokens)}`} sub="entrée / sortie" />
        <StatCard icon={<LogIn className="h-5 w-5" />} tone="emerald" label="Connexions 24 h"
          value={nf.format(data.logins.last24h)} sub="connexions réussies" />
        <StatCard icon={<ShieldAlert className="h-5 w-5" />} tone="pink" label="Échecs de connexion"
          value={nf.format(data.logins.failed7d)} sub="sur 7 jours" />
      </div>

      {/* Graphe d'activité */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-foreground">Activité — 14 derniers jours</h3>
        </div>
        <ActivityChart analyses={data.series.analyses} comparisons={data.series.comparisons} chat={data.series.chat} />
      </Card>

      {/* Répartition comptes */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Administrateurs" value={data.users.admins} />
        <MiniStat label="E-mails vérifiés" value={data.users.verified} />
        <MiniStat label="Nouveaux (30 j)" value={data.users.new30d} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex items-center justify-between py-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-heading text-xl font-bold text-foreground">{nf.format(value)}</span>
    </Card>
  );
}
