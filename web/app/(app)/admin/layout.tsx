import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getAdminSession } from "@/lib/admin/guard";
import { GradientHeader } from "@/components/ui/gradient-header";

/** Espace admin : protégé côté serveur (role=admin), sinon redirection. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/accueil");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title="Dashboard administrateur"
        subtitle="Vue complète de la plateforme : utilisateurs, activité, consommation, coûts API et actions d'administration."
        icon={<ShieldCheck className="h-6 w-6" />}
      />
      {children}
    </div>
  );
}
