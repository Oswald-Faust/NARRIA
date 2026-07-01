"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trash2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatUsd } from "@/lib/pricing";

interface AdminUser {
  id: string; email: string; nomComplet: string; role: string; plan: string;
  emailVerified: boolean; isActive: boolean; country: string; createdAt: string;
  lastLoginAt: string | null; loginCount: number;
  analyses: number; comparisons: number; aiRequests: number; tokens: number; costUsd: number;
}

const nf = new Intl.NumberFormat("fr-FR");
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    const data = await fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setUsers(data?.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        setUsers(data?.users ?? []);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      nomComplet: form.get("nomComplet"),
      prenom: form.get("prenom"),
      email: form.get("email"),
      password: form.get("password"),
      role: form.get("role"),
    };

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Création impossible");
      e.currentTarget.reset();
      setFeedback("Compte créé.");
      await loadUsers();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setCreating(false);
    }
  }

  async function deleteUser(user: AdminUser) {
    const confirmed = window.confirm(`Supprimer le compte de ${user.nomComplet || user.email} ?`);
    if (!confirmed) return;

    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setFeedback(data?.error || "Suppression impossible");
      return;
    }
    setFeedback("Compte supprimé.");
    await loadUsers();
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => u.email.toLowerCase().includes(s) || u.nomComplet.toLowerCase().includes(s));
  }, [users, q]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-soft-pink" />
          <h3 className="font-heading text-base font-bold text-foreground">Créer un compte utilisateur ou admin</h3>
        </div>
        <form onSubmit={createUser} className="grid gap-4 lg:grid-cols-5">
          <div>
            <Label htmlFor="nomComplet">Nom complet</Label>
            <Input id="nomComplet" name="nomComplet" required placeholder="ADEKAMBI David" />
          </div>
          <div>
            <Label htmlFor="prenom">Prénom</Label>
            <Input id="prenom" name="prenom" required placeholder="David" />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required placeholder="david@narria.dev" />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe initial</Label>
            <Input id="password" name="password" type="password" required placeholder="Minimum 8 caractères" />
          </div>
          <div>
            <Label htmlFor="role">Rôle</Label>
            <select
              id="role"
              name="role"
              defaultValue="user"
              className="h-11 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
          <div className="lg:col-span-5 flex items-center gap-3">
            <Button type="submit" disabled={creating}>
              <UserPlus className="h-4 w-4" />
              {creating ? "Création…" : "Créer le compte"}
            </Button>
            {feedback && <p className="text-sm text-muted">{feedback}</p>}
          </div>
        </form>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">{nf.format(filtered.length)} utilisateur(s)</p>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom ou e-mail…"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-muted">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-muted">Aucun utilisateur.</p>
        ) : (
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Analyses</th>
                <th className="px-4 py-3">Compar.</th>
                <th className="px-4 py-3">Req. IA</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">Coût</th>
                <th className="px-4 py-3">Connex.</th>
                <th className="px-4 py-3">Dernière</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/utilisateurs/${u.id}`} className="block">
                      <span className="font-semibold text-foreground hover:text-accent">{u.nomComplet || "—"}</span>
                      <span className="block text-xs text-muted">{u.email}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === "admin" ? "pink" : "neutral"}>{u.role}</Badge>
                    {!u.isActive && <Badge tone="danger" className="ml-1">inactif</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">{nf.format(u.analyses)}</td>
                  <td className="px-4 py-3 text-muted">{nf.format(u.comparisons)}</td>
                  <td className="px-4 py-3 text-muted">{nf.format(u.aiRequests)}</td>
                  <td className="px-4 py-3 text-muted">{nf.format(u.tokens)}</td>
                  <td className="px-4 py-3 text-muted">{formatUsd(u.costUsd)}</td>
                  <td className="px-4 py-3 text-muted">{nf.format(u.loginCount)}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/utilisateurs/${u.id}`} className="text-xs font-semibold text-soft-pink hover:underline">
                        Ouvrir
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteUser(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
