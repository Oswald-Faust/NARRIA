import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { Card } from "@/components/ui/card";

export default async function JoinProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  // Le middleware (proxy.ts) redirige déjà vers /login si non connecté, donc session existe ici.
  const userId = session!.user!.id!;

  await connectDB();
  const project = await Project.findOne({ inviteLinkToken: token }).lean();

  if (!project || project.confidential) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="text-sm text-red-400">
          Ce lien d&apos;invitation est invalide, expiré, ou le projet est confidentiel.
          <div className="mt-3">
            <Link href="/projets" className="text-soft-pink underline">Retour à mes projets</Link>
          </div>
        </Card>
      </div>
    );
  }

  const existing = await ProjectMember.findOne({ projectId: project._id, userId });
  if (!existing) {
    await ProjectMember.create({ projectId: project._id, userId, role: project.inviteLinkRole });
  }

  redirect(`/projets/${String(project._id)}`);
}
