import { Types } from "mongoose";
import { FolderKanban } from "lucide-react";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { getProjectRole } from "@/lib/projects/permissions";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card } from "@/components/ui/card";
import { ProjectTabs } from "@/components/projets/project-tabs";

/**
 * Coquille commune à toutes les pages d'un projet : identité du projet + navigation
 * vers ses outils. Les outils (analyse, comparaison, chat) sont montés SOUS cette route,
 * de sorte qu'on reste toujours dans le contexte du projet.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const notFound = (
    <div className="mx-auto max-w-lg">
      <Card className="text-sm text-red-400">Projet introuvable ou accès non autorisé.</Card>
    </div>
  );

  if (!Types.ObjectId.isValid(id)) return notFound;

  await connectDB();
  const role = await getProjectRole(id, userId);
  if (!role) return notFound;

  const project = await Project.findById(id).lean();
  if (!project) return notFound;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <GradientHeader
        title={project.name}
        subtitle={`${project.type} · ${project.category || "—"}`}
        icon={<FolderKanban className="h-6 w-6" />}
      />
      <ProjectTabs id={id} role={role} />
      {children}
    </div>
  );
}
