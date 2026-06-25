"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      nomComplet: form.get("nomComplet"),
      prenom: form.get("prenom"),
      email: form.get("email"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
      cgu: form.get("cgu") === "on",
    };
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'inscription.");
      return;
    }
    router.push(`/otp?email=${encodeURIComponent(data.email)}`);
  }

  return (
    <AuthShell
      badge="Analyse narrative computationnelle"
      title={
        <>
          Protégez votre
          <br />
          créativité.
        </>
      }
      subtitle="Rejoignez des auteurs qui font confiance à NARR'IA pour analyser et défendre leurs œuvres."
    >
      <h2 className="font-display text-4xl font-semibold tracking-wide">Créer un compte</h2>
      <p className="mt-2 text-sm text-muted">
        Rejoignez NARR&apos;IA et protégez vos œuvres.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nom complet</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input name="nomComplet" required placeholder="ADEKAMBI" className="pl-10" />
            </div>
          </div>
          <div>
            <Label>Prénom</Label>
            <Input name="prenom" required placeholder="David" />
          </div>
        </div>
        <div>
          <Label>Adresse e-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input name="email" type="email" required placeholder="vous@exemple.com" className="pl-10" />
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
              placeholder="8 caractères minimum"
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
        <div>
          <Label>Confirmer le mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              name="confirmPassword"
              type={show ? "text" : "password"}
              required
              placeholder="••••••••"
              className="pl-10"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="cgu" required className="accent-pink" />
          En créant un compte, vous acceptez nos CGU.
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Création…" : "Créer mon compte"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-semibold text-soft-pink hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}
