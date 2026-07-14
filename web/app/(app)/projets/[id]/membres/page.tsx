"use client";

import { useEffect, useRef, useState, use } from "react";
import { Mail, Copy, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";

interface ProjectDetail {
  id: string; name: string; confidential: boolean; inviteLinkToken: string | null;
  members: { userId: string; role: string; name: string; email: string }[];
  pendingInvitations: { id: string; email: string; role: string }[];
}

export default function ProjectMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"co-admin" | "collaborateur" | "lecteur">("collaborateur");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reloadSeqRef = useRef(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (res.ok) setProject(data);
        else setError(data.error ?? "Projet introuvable.");
      })
      .catch(() => {
        if (active) setError("Erreur de chargement.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function reload() {
    const seq = ++reloadSeqRef.current;
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json().catch(() => null);
    if (seq !== reloadSeqRef.current) return;
    if (res.ok) setProject(data);
    else setError(data?.error ?? "Erreur lors du rechargement.");
  }

  async function invite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'invitation.");
        return;
      }
      setEmail("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitationId: string) {
    if (busy) return;
    if (!window.confirm("Révoquer cette invitation ?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/invitations/${invitationId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erreur lors de la révocation.");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, newRole: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erreur lors du changement de rôle.");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (busy) return;
    if (!window.confirm("Retirer ce membre du projet ?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erreur lors du retrait du membre.");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function regenerateLink() {
    if (busy) return;
    if (!window.confirm("Régénérer le lien d'invitation ? L'ancien lien cessera de fonctionner immédiatement.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/invite-link`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erreur lors de la régénération du lien.");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!project) return <LoadingBlock />;

  const inviteLinkUrl = project.inviteLinkToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/projets/rejoindre/${project.inviteLinkToken}`
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card className="space-y-3">
        <CardTitle>Inviter par e-mail</CardTitle>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Entrer l'adresse e-mail…" />
        <div className="flex gap-2">
          {(["co-admin", "collaborateur", "lecteur"] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} className={`rounded-full px-3 py-1 text-xs capitalize ${role === r ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}>
              {r}
            </button>
          ))}
        </div>
        <Button variant="purple" className="w-full" onClick={invite} disabled={busy}><Mail className="h-4 w-4" /> Envoyer l&apos;invitation</Button>
      </Card>

      {project.pendingInvitations.length > 0 && (
        <Card className="space-y-2">
          <CardTitle>Invitations en attente</CardTitle>
          {project.pendingInvitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{inv.email}</span>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{inv.role}</Badge>
                <button onClick={() => revoke(inv.id)} disabled={busy} aria-label={`Révoquer l'invitation de ${inv.email}`} className="text-muted hover:text-red-400 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>Membres</CardTitle>
        {project.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{m.name || m.email || "Utilisateur inconnu"}</p>
              <p className="truncate text-xs text-muted">{m.email || m.userId}</p>
            </div>
            {m.role === "owner" ? (
              <Badge tone="purple">owner</Badge>
            ) : (
              <div className="flex items-center gap-2">
                <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} disabled={busy} className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-foreground disabled:opacity-50">
                  <option value="co-admin">co-admin</option>
                  <option value="collaborateur">collaborateur</option>
                  <option value="lecteur">lecteur</option>
                </select>
                <button onClick={() => removeMember(m.userId)} disabled={busy} aria-label="Retirer ce membre" className="text-muted hover:text-red-400 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Lien d&apos;invitation</CardTitle>
        {project.confidential ? (
          <p className="text-sm text-muted">Désactivé — ce projet est confidentiel (invitations e-mail nominatives uniquement).</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input value={inviteLinkUrl ?? ""} readOnly />
              <Button variant="secondary" size="icon" aria-label="Copier le lien" onClick={() => inviteLinkUrl && navigator.clipboard.writeText(inviteLinkUrl)}><Copy className="h-4 w-4" /></Button>
            </div>
            <Button variant="secondary" onClick={regenerateLink} disabled={busy}><RefreshCw className="h-4 w-4" /> Régénérer le lien</Button>
          </>
        )}
      </Card>
    </div>
  );
}
