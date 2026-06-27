"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bell, ScanText, GitCompareArrows, LogIn, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { StatCard } from "@/components/admin/stat-card";
import { formatUsd } from "@/lib/pricing";

interface Detail {
  user: {
    id: string; email: string; nomComplet: string; prenom: string; role: string; plan: string;
    profession: string; country: string; emailVerified: boolean; isActive: boolean; twoFactor: boolean;
    createdAt: string; lastLoginAt: string | null; loginCount: number;
  };
  usage: { requests: number; tokens: number; inputTokens: number; outputTokens: number; costUsd: number };
  analyses: { id: string; title: string; author: string; nNodes: number; createdAt: string }[];
  comparisons: { id: string; refTitle: string; candTitle: string; sns: number; srjLevel: string; createdAt: string }[];
  logins: { id: string; ip: string; userAgent: string; success: boolean; createdAt: string }[];
}

const nf = new Intl.NumberFormat("fr-FR");
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifHref, setNotifHref] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Card>Chargement…</Card>;
  if (!data) return <Card>Utilisateur introuvable.</Card>;

  const { user, usage } = data;

  async function sendNotification() {
    setFeedback(null);
    setSending(true);
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notifTitle,
          message: notifMessage,
          href: notifHref,
        }),
      });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || "Envoi impossible");
      setNotifTitle("");
      setNotifMessage("");
      setNotifHref("");
      setFeedback({ type: "success", text: "Notification envoyée." });
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Envoi impossible" });
    } finally {
      setSending(false);
    }
  }

  async function deleteUser() {
    const confirmed = window.confirm(
      `Supprimer définitivement le compte de ${user.nomComplet || user.email} et ses données associées ?`,
    );
    if (!confirmed) return;

    setFeedback(null);
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || "Suppression impossible");
      window.location.href = "/admin/utilisateurs";
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Suppression impossible" });
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux utilisateurs
      </Link>

      {/* En-tête profil */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-pink/20 text-xl font-bold text-soft-pink">
            {(user.nomComplet || user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">{user.nomComplet || "—"}</h2>
            <p className="text-sm text-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={user.role === "admin" ? "pink" : "neutral"}>{user.role}</Badge>
              <Badge tone="purple">{user.plan}</Badge>
              {user.emailVerified ? <Badge tone="success">vérifié</Badge> : <Badge tone="yellow">non vérifié</Badge>}
              {user.twoFactor && <Badge tone="success">2FA</Badge>}
              {!user.isActive && <Badge tone="danger">inactif</Badge>}
            </div>
          </div>
        </div>
        <div className="text-sm text-muted sm:text-right">
          <p>Inscrit le {fmt(user.createdAt)}</p>
          <p>Dernière connexion : {fmt(user.lastLoginAt)}</p>
          <p>{nf.format(user.loginCount)} connexion(s)</p>
          {user.country && <p>Pays : {user.country}</p>}
        </div>
      </Card>

      {/* Stats usage */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ScanText className="h-5 w-5" />} tone="sky" label="Analyses" value={nf.format(data.analyses.length)} sub="récentes (max 25)" />
        <StatCard icon={<GitCompareArrows className="h-5 w-5" />} tone="pink" label="Comparaisons" value={nf.format(data.comparisons.length)} sub="récentes (max 25)" />
        <StatCard icon={<LogIn className="h-5 w-5" />} tone="emerald" label="Requêtes IA" value={nf.format(usage.requests)} sub={`${nf.format(usage.tokens)} tokens`} />
        <StatCard icon={<ScanText className="h-5 w-5" />} tone="amber" label="Coût IA estimé" value={formatUsd(usage.costUsd)} sub={`${nf.format(usage.inputTokens)} in / ${nf.format(usage.outputTokens)} out`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-soft-pink" />
            <h3 className="font-heading text-base font-bold text-foreground">Envoyer une notification</h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notif-title">Titre</Label>
              <Input
                id="notif-title"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Ex. Action requise sur votre compte"
              />
            </div>
            <div>
              <Label htmlFor="notif-message">Message</Label>
              <Textarea
                id="notif-message"
                rows={5}
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Message destiné à l'utilisateur…"
              />
            </div>
            <div>
              <Label htmlFor="notif-href">Lien optionnel</Label>
              <Input
                id="notif-href"
                value={notifHref}
                onChange={(e) => setNotifHref(e.target.value)}
                placeholder="/configuration"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={sendNotification} disabled={sending || !notifTitle.trim()}>
                <Bell className="h-4 w-4" />
                {sending ? "Envoi…" : "Envoyer"}
              </Button>
              <p className="text-xs text-muted">Notification stockée dans le centre de notifications de l&apos;utilisateur.</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border-red-500/30">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-300" />
            <h3 className="font-heading text-base font-bold text-foreground">Zone sensible</h3>
          </div>
          <p className="text-sm text-muted">
            La suppression efface le compte utilisateur ainsi que ses analyses, comparaisons, usages API, connexions et notifications.
          </p>
          <Button
            variant="outline"
            className="border-red-500/40 text-red-200 hover:bg-red-500/10"
            onClick={deleteUser}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Suppression…" : "Supprimer le compte"}
          </Button>
        </Card>
      </div>

      {feedback && (
        <Card className={feedback.type === "success" ? "border-emerald-500/30" : "border-red-500/30"}>
          <p className={feedback.type === "success" ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
            {feedback.text}
          </p>
        </Card>
      )}

      {/* Analyses & comparaisons */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-0">
          <h3 className="border-b border-border px-5 py-3 font-heading text-sm font-bold">Analyses récentes</h3>
          {data.analyses.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aucune analyse.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {data.analyses.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="min-w-0"><span className="font-medium text-foreground">{a.title}</span><span className="block text-xs text-muted">{a.nNodes} nœuds · {fmt(a.createdAt)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-0">
          <h3 className="border-b border-border px-5 py-3 font-heading text-sm font-bold">Comparaisons récentes</h3>
          {data.comparisons.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aucune comparaison.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {data.comparisons.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate"><span className="font-medium text-foreground">{c.refTitle}</span> <span className="text-muted">/ {c.candTitle}</span><span className="block text-xs text-muted">{fmt(c.createdAt)}</span></span>
                  <Badge tone={c.srjLevel === "Critique" ? "danger" : c.srjLevel === "Élevé" ? "pink" : "neutral"}>{(c.sns * 100).toFixed(0)} %</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Connexions */}
      <Card className="p-0">
        <h3 className="border-b border-border px-5 py-3 font-heading text-sm font-bold">Connexions récentes</h3>
        {data.logins.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aucune connexion enregistrée.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {data.logins.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className={l.success ? "text-emerald-400" : "text-red-400"}>{l.success ? "Réussie" : "Échouée"}</span>
                  <span className="block truncate text-xs text-muted">{l.ip || "IP inconnue"} · {l.userAgent.slice(0, 60) || "—"}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{fmt(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
