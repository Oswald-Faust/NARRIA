"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Users, Search, Plus } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProjectItem {
  id: string;
  name: string;
  type: string;
  category: string;
  role: string | null;
  nDocuments: number;
  updatedAt: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

export default function ProjectsPage() {
  const [tab, setTab] = useState<"tous" | "archives">("tous");
  const [q, setQ] = useState("");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [nPersonal, setNPersonal] = useState(0);
  const [nCollaborations, setNCollaborations] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    const params = new URLSearchParams({ tab, q });
    fetch(`/api/projects?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        setProjects(d?.projects ?? []);
        setNPersonal(d?.nPersonal ?? 0);
        setNCollaborations(d?.nCollaborations ?? 0);
      })
      .catch(() => {
        if (!active) return;
        setProjects([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, q]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title="Projets"
        subtitle="Organisez votre travail par dossiers complexes — affaires de plagiat, contentieux éditoriaux, mandats d'agents. Un espace dédié à chaque mission."
        icon={<FolderKanban className="h-6 w-6" />}
        action={
          <Link href="/projets/nouveau">
            <Button variant="primary">
              <Plus className="h-4 w-4" /> Nouveau projet
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-purple/15">
            <FolderKanban className="h-5 w-5 text-soft-purple" />
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">{nPersonal}</p>
            <p className="text-sm text-muted">Projets personnels</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-pink/15">
            <Users className="h-5 w-5 text-soft-pink" />
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">{nCollaborations}</p>
            <p className="text-sm text-muted">Collaborations</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["tous", "archives"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un projet…" className="pl-9" />
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{p.name}</CardTitle>
                  <p className="text-xs text-muted">{p.type} · {p.category || "—"}</p>
                </div>
                {p.role && p.role !== "owner" && <Badge tone="neutral">Collaboration</Badge>}
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted">{p.nDocuments} docs · Mis à jour {fmt(p.updatedAt)}</span>
                <Link href={`/projets/${p.id}`}>
                  <Button variant="secondary" size="sm">Ouvrir →</Button>
                </Link>
              </div>
            </Card>
          ))}
          <Link href="/projets/nouveau">
            <Card className="flex h-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-transparent text-center hover:border-soft-pink">
              <Plus className="h-6 w-6 text-soft-pink" />
              <p className="font-heading font-bold text-foreground">Nouveau projet</p>
              <p className="text-xs text-muted">Créer un nouveau dossier</p>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
