import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { findInvitationForUser } from "@/lib/projects/invitation-lookup";
import { Card } from "@/components/ui/card";
import { AcceptInvitationActions } from "@/components/projets/accept-invitation";

const ROLE_LABELS: Record<string, string> = {
  "co-admin": "Co-administrateur",
  collaborateur: "Collaborateur",
  lecteur: "Lecteur",
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  // Le middleware (proxy.ts) redirige déjà vers /login si non connecté ; ici la session existe.
  const userId = session!.user!.id!;

  await connectDB();
  const invitation = await findInvitationForUser(token, session!.user!.email);

  if (!invitation || invitation.status === "revoked") {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="space-y-3 text-sm">
          <p className="text-foreground">Cette invitation n&apos;est plus valide.</p>
          <p className="text-muted">
            Elle a peut-être déjà été acceptée — auquel cas le projet figure directement dans vos
            projets — ou elle a été révoquée par son auteur.
          </p>
          <Link href="/projets" className="inline-block text-soft-pink underline">Voir mes projets</Link>
        </Card>
      </div>
    );
  }

  const project = await Project.findById(invitation.projectId).lean();
  if (!project) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="text-sm text-red-400">
          Le projet associé à cette invitation n&apos;existe plus.
          <div className="mt-3">
            <Link href="/projets" className="text-soft-pink underline">Retour à mes projets</Link>
          </div>
        </Card>
      </div>
    );
  }

  // Déjà membre (ou invitation déjà acceptée) : on va directement au projet.
  const existingMember = await ProjectMember.findOne({ projectId: invitation.projectId, userId });
  if (existingMember || invitation.status === "accepted") {
    redirect(`/projets/${String(invitation.projectId)}`);
  }

  const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;

  return (
    <div className="mx-auto max-w-lg pt-6">
      <Card className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink">
          <Users className="h-7 w-7 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Rejoindre « {project.name} » ?
          </h1>
          <p className="text-sm text-muted">
            Vous avez été invité à collaborer sur ce projet en tant que{" "}
            <span className="font-semibold text-foreground">{roleLabel}</span>.
          </p>
        </div>
        <AcceptInvitationActions token={token} />
      </Card>
    </div>
  );
}
