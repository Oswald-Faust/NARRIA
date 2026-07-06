"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, X, Mail } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const PROJECT_TYPES = ["Contentieux de plagiat", "Mandat d'agent", "Cession de droits", "Autre"];
type PendingInvite = { email: string; role: "co-admin" | "collaborateur" | "lecteur" };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".mp3"];

function fileRejectionReason(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return "trop volumineux (max 20 Mo)";
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return "format non supporté";
  return null;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState(PROJECT_TYPES[0]);
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [confidential, setConfidential] = useState(true);
  const [notifyOnInvite, setNotifyOnInvite] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PendingInvite["role"]>("collaborateur");
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  function addInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email.includes("@")) return;
    setInvites((prev) => [...prev, { email, role: inviteRole }]);
    setInviteEmail("");
  }

  function addFiles(newFiles: File[]) {
    const rejections: string[] = [];
    const accepted: File[] = [];
    for (const file of newFiles) {
      const reason = fileRejectionReason(file);
      if (reason) rejections.push(`${file.name} (${reason})`);
      else accepted.push(file);
    }
    if (rejections.length > 0) {
      setError(`Fichier(s) ignoré(s) : ${rejections.join(", ")}.`);
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
  }

  async function createProject() {
    if (!name.trim()) {
      setError("Le nom du projet est requis.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, category, summary, confidential, notifyOnInvite, invitations: invites }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création du projet.");
        return;
      }
      const projectId = data.id as string;

      const failed: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        try {
          const uploadRes = await fetch(`/api/projects/${projectId}/attachments`, { method: "POST", body: form });
          if (!uploadRes.ok) failed.push(file.name);
        } catch {
          failed.push(file.name);
        }
      }

      if (failed.length > 0) {
        setCreatedProjectId(projectId);
        setError(`Projet créé, mais ${failed.length} pièce(s) jointe(s) n'ont pas pu être importées : ${failed.join(", ")}.`);
        return;
      }

      router.push(`/projets/${projectId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title="Nouveau Projet"
        subtitle="Créez un nouveau dossier de projet — définissez son nom, son type, ajoutez des collaborateurs et joignez vos premiers documents."
        icon={<FolderPlus className="h-6 w-6" />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="space-y-4">
            <CardTitle>Informations générales</CardTitle>
            <div>
              <Label>Nom du projet *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Affaire Dupont / Éditions Maro" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Type de projet *</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm text-foreground"
                >
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Catégorie d&apos;œuvre</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. Roman · Littérature générale" />
              </div>
            </div>
            <div>
              <Label>Résumé du projet</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Décrivez brièvement ce projet, son contexte, les enjeux et les parties impliquées…" />
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>Pièces jointes</CardTitle>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-surface-2 px-4 py-6 text-center hover:border-soft-pink">
              <input
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(",")}
                className="hidden"
                onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
              />
              <p className="text-sm text-foreground">Glissez vos fichiers ici ou cliquez pour parcourir</p>
              <p className="text-xs text-muted">PDF, DOCX, TXT, MP3 · Max 20 Mo par fichier</p>
            </label>
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
                <span className="truncate text-foreground">{f.name}</span>
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-3">
            <CardTitle>Inviter un collaborateur</CardTitle>
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Entrer l'adresse e-mail…"
              onKeyDown={(e) => e.key === "Enter" && addInvite()}
            />
            <div className="flex flex-wrap gap-2">
              {(["co-admin", "collaborateur", "lecteur"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`rounded-full px-3 py-1 text-xs capitalize ${inviteRole === r ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button variant="purple" className="w-full" onClick={addInvite}>
              <Mail className="h-4 w-4" /> Envoyer l&apos;invitation
            </Button>
            <div className="space-y-2 pt-2">
              {invites.map((inv, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{inv.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{inv.role}</Badge>
                    <button onClick={() => setInvites((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <CardTitle>Options du projet</CardTitle>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Projet confidentiel<br /><span className="text-xs text-muted">Accès restreint aux collaborateurs invités</span></span>
              <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} className="h-5 w-9 accent-accent" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Notifier les collaborateurs<br /><span className="text-xs text-muted">Envoyer un email à l&apos;invitation</span></span>
              <input type="checkbox" checked={notifyOnInvite} onChange={(e) => setNotifyOnInvite(e.target.checked)} className="h-5 w-9 accent-accent" />
            </label>
          </Card>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {createdProjectId ? (
            <Button variant="primary" className="w-full" onClick={() => router.push(`/projets/${createdProjectId}`)}>
              Accéder au projet
            </Button>
          ) : (
            <Button variant="primary" className="w-full" onClick={createProject} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              Créer le projet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
