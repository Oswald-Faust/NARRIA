"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { FolderKanban, ScanText, GitCompareArrows, MessageSquare, Sparkles, Paperclip, Settings, Loader2 } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SessionItem { kind: "analysis" | "comparison" | "chat"; id: string; title: string; ownerId: string; createdAt: string }
interface ProjectDetail {
  id: string; name: string; type: string; category: string; createdAt: string; role: string; viewerId: string;
  counts: { analyses: number; comparisons: number; chats: number };
  sessions: SessionItem[];
  members: { userId: string; role: string }[];
  lastSynthesis: { text: string; generatedAt: string | null } | null;
  attachments: { id: string; filename: string; url: string; size: number }[];
}

const fmtRelative = (d: string) => {
  const diffMs = Date.now() - new Date(d).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
};

const sessionHref = (s: SessionItem) =>
  s.kind === "analysis" ? `/historique/analyses/${s.id}` : s.kind === "comparison" ? `/historique/comparaisons/${s.id}` : `/chat?conversationId=${s.id}`;

const sessionIcon = (kind: SessionItem["kind"]) =>
  kind === "analysis" ? <ScanText className="h-4 w-4 text-soft-purple" /> : kind === "comparison" ? <GitCompareArrows className="h-4 w-4 text-soft-pink" /> : <MessageSquare className="h-4 w-4 text-yellow" />;

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<"projet" | "moi">("projet");
  const [synthLoading, setSynthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setProject(data);
        else setError(data.error ?? "Projet introuvable.");
      })
      .catch(() => setError("Erreur de chargement."));
  }, [id]);

  async function runSynthesis() {
    setError(null);
    setSynthLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/synthesis`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setProject((p) => (p ? { ...p, lastSynthesis: { text: data.text, generatedAt: data.generatedAt } } : p));
      else setError(data.error ?? "Erreur lors de la synthèse.");
    } finally {
      setSynthLoading(false);
    }
  }

  if (error && !project) return <Card className="mx-auto max-w-lg text-sm text-red-400">{error}</Card>;
  if (!project) return <p className="text-muted">Chargement…</p>;

  const canLaunch = project.role === "owner" || project.role === "co-admin" || project.role === "collaborateur";
  const canManage = project.role === "owner" || project.role === "co-admin";
  const sessions = tab === "moi" ? project.sessions.filter((s) => s.ownerId === project.viewerId) : project.sessions;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title={project.name}
        subtitle={`${project.type} · ${project.category || "—"} · Créé le ${new Date(project.createdAt).toLocaleDateString("fr-FR")} · ${project.members.length} collaborateur(s)`}
        icon={<FolderKanban className="h-6 w-6" />}
        action={canManage ? (
          <Link href={`/projets/${id}/membres`}>
            <Button variant="secondary"><Settings className="h-4 w-4" /> Gérer les collaborateurs</Button>
          </Link>
        ) : undefined}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div>
        <p className="mb-2 text-sm font-semibold text-muted">Outils du projet</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <ToolCard icon={<ScanText className="h-5 w-5 text-soft-purple" />} count={project.counts.analyses} label="Analyse de texte" href={canLaunch ? `/analyser?projectId=${id}` : undefined} cta="Lancer" />
          <ToolCard icon={<GitCompareArrows className="h-5 w-5 text-soft-pink" />} count={project.counts.comparisons} label="Comparer deux textes" href={canLaunch ? `/comparer?projectId=${id}` : undefined} cta="Lancer" />
          <ToolCard icon={<MessageSquare className="h-5 w-5 text-yellow" />} count={project.counts.chats} label="NARR'IA Chat" href={`/chat?projectId=${id}`} cta="Ouvrir" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>Historique des sessions</CardTitle>
              <div className="flex gap-2">
                {(["projet", "moi"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs ${tab === t ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}>
                    {t === "projet" ? "Sessions du projet" : "Mes sessions"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sessions.length === 0 && <p className="py-4 text-sm text-muted">Aucune session pour le moment.</p>}
              {sessions.map((s) => (
                <div key={`${s.kind}-${s.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                  {sessionIcon(s.kind)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-xs text-muted">{fmtRelative(s.createdAt)}</p>
                  </div>
                  <Link href={sessionHref(s)}><Button variant="secondary" size="sm">Voir</Button></Link>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-soft-pink" /> Synthèse des rapports</CardTitle>
            {project.lastSynthesis?.text ? (
              <p className="whitespace-pre-line text-sm text-foreground/90">{project.lastSynthesis.text}</p>
            ) : (
              <p className="text-sm text-muted">Aucune synthèse générée pour le moment.</p>
            )}
            {canLaunch && (
              <Button variant="purple" className="w-full" onClick={runSynthesis} disabled={synthLoading}>
                {synthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {project.lastSynthesis?.text ? "Régénérer la synthèse" : "Générer la synthèse"}
              </Button>
            )}
          </Card>

          <Card className="space-y-2">
            <CardTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Pièces jointes</CardTitle>
            {project.attachments.length === 0 && <p className="text-sm text-muted">Aucune pièce jointe.</p>}
            {project.attachments.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block truncate rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground hover:border-soft-pink">
                {a.filename}
              </a>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ icon, count, label, href, cta }: { icon: React.ReactNode; count: number; label: string; href?: string; cta: string }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">{icon}</div>
        <Badge tone="neutral">{count} {count > 1 ? "sessions" : "session"}</Badge>
      </div>
      <CardTitle className="text-base">{label}</CardTitle>
      {href ? (
        <Link href={href}><Button variant="primary" size="sm" className="w-full">{cta}</Button></Link>
      ) : (
        <Button variant="secondary" size="sm" className="w-full" disabled>{cta}</Button>
      )}
    </Card>
  );
}
