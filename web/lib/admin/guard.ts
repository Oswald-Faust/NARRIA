import { auth } from "@/auth";

export interface AdminSession {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
}

/** Renvoie la session si l'utilisateur est admin, sinon null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string | null; name?: string | null; role?: string }
    | undefined;
  if (!user?.id || user.role !== "admin") return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
