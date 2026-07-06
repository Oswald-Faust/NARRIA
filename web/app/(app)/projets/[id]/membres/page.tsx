"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Users, Mail, Copy, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProjectDetail {
  id: string; name: string; confidential: boolean; inviteLinkToken: string | null;
  members: { userId: string; role: string }[];
  pendingInvitations: { id: string; email: string; role: string }[];
}

export default function ProjectMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"co-admin" | "collaborateur" | "lecteur">("collaborateur");
  const [error, setError] = useState<string | null>(null);

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
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    if (res.ok) setProject(data);
  }

  async function invite() {
    setError(null);
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
  }

  async function revoke(invitationId: string) {
    setError(null);
    const res = await fetch(`/api/projects/${id}/invitations/${invitationId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur lors de la révocation.");
      return;
    }
    await reload();
  }

  async function changeRole(userId: string, newRole: string) {
    setError(null);
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
  }

  async function removeMember(userId: string) {
    setError(null);
    const res = await fetch(`/api/projects/${id}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur lors du retrait du membre.");
      return;
    }
    await reload();
  }

  async function regenerateLink() {
    setError(null);
    const res = await fetch(`/api/projects/${id}/invite-link`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur lors de la régénération du lien.");
      return;
    }
    await reload();
  }

  if (!project) return <p className="text-muted">Chargement…</p>;

  const inviteLinkUrl = project.inviteLinkToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/projets/rejoindre/${project.inviteLinkToken}`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <GradientHeader title="Gérer les collaborateurs" subtitle={project.name} icon={<Users className="h-6 w-6" />} />

      <Link href={`/projets/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au projet
      </Link>

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
        <Button variant="purple" className="w-full" onClick={invite}><Mail className="h-4 w-4" /> Envoyer l&apos;invitation</Button>
      </Card>

      {project.pendingInvitations.length > 0 && (
        <Card className="space-y-2">
          <CardTitle>Invitations en attente</CardTitle>
          {project.pendingInvitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{inv.email}</span>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{inv.role}</Badge>
                <button onClick={() => revoke(inv.id)} className="text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>Membres</CardTitle>
        {project.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{m.userId}</span>
            {m.role === "owner" ? (
              <Badge tone="purple">owner</Badge>
            ) : (
              <div className="flex items-center gap-2">
                <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-foreground">
                  <option value="co-admin">co-admin</option>
                  <option value="collaborateur">collaborateur</option>
                  <option value="lecteur">lecteur</option>
                </select>
                <button onClick={() => removeMember(m.userId)} className="text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
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
              <Button variant="secondary" size="icon" onClick={() => inviteLinkUrl && navigator.clipboard.writeText(inviteLinkUrl)}><Copy className="h-4 w-4" /></Button>
            </div>
            <Button variant="secondary" onClick={regenerateLink}><RefreshCw className="h-4 w-4" /> Régénérer le lien</Button>
          </>
        )}
      </Card>
    </div>
  );
}
