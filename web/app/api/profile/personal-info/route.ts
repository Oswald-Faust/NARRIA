import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/user";
import { personalInfoSchema } from "@/lib/auth/schemas";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = personalInfoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findByIdAndUpdate(
    session.user.id,
    {
      nomComplet: parsed.data.nomComplet.trim(),
      profession: parsed.data.profession.trim(),
      narrativeSpecialty: parsed.data.narrativeSpecialty.trim(),
      country: parsed.data.country.trim(),
      langue: parsed.data.langue.trim(),
    },
    { new: true },
  ).lean();

  return NextResponse.json({
    ok: true,
    profile: {
      nomComplet: user?.nomComplet ?? parsed.data.nomComplet,
      profession: user?.profession ?? parsed.data.profession,
      narrativeSpecialty: user?.narrativeSpecialty ?? parsed.data.narrativeSpecialty,
      country: user?.country ?? parsed.data.country,
      langue: user?.langue ?? parsed.data.langue,
    },
  });
}
