"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("E-mail ou mot de passe incorrect (ou compte non vérifié).");
      return;
    }
    router.push("/accueil");
  }

  return (
    <AuthShell
      badge="Analyse narrative computationnelle"
      title={
        <>
          Détectez le vol
          <br />
          d&apos;intrigue.
        </>
      }
      subtitle="Structurez, comparez et protégez vos œuvres grâce à l'IA."
    >
      <h2 className="font-heading text-3xl font-bold">Bon retour 👋</h2>
      <p className="mt-2 text-sm text-muted">
        Connectez-vous à votre espace NARR&apos;IA.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label>Adresse e-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              name="email"
              type="email"
              required
              placeholder="vous@exemple.com"
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label>Mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              name="password"
              type={show ? "text" : "password"}
              required
              placeholder="••••••••"
              className="px-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-soft-pink hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Connexion…" : "Accéder à NARR'IA"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-semibold text-soft-pink hover:underline">
          Créez votre compte
        </Link>
      </p>
    </AuthShell>
  );
}
