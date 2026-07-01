import { AppShell } from "@/components/shell/app-shell";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let name = session?.user?.name || "Utilisateur NARR'IA";
  let email = session?.user?.email || "compte@narria.local";
  let role = (session?.user as { role?: string } | undefined)?.role || "user";

  if (session?.user?.id) {
    await connectDB();
    const user = await User.findById(session.user.id).lean();
    if (user?.nomComplet) name = user.nomComplet;
    if (user?.email) email = user.email;
    if (user?.role) role = user.role;
  }

  const firstName = name.split(" ").filter(Boolean).at(-1) || name;
  const initial = name.trim().charAt(0).toUpperCase() || "N";

  return (
    <AppShell
      user={{
        id: session?.user?.id || "",
        name,
        email,
        firstName,
        initial,
        role,
      }}
    >
      {children}
    </AppShell>
  );
}
