"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <AuthShell
      badge="Récupération de compte"
      title={
        <>
          Un instant
          <br />
          d&apos;oubli ?
        </>
      }
      subtitle="Indiquez votre adresse e-mail : nous vous enverrons un lien de réinitialisation."
    >
      <h2 className="font-heading text-3xl font-bold">Mot de passe oublié</h2>
      {sent ? (
        <p className="mt-4 text-sm text-muted">
          Si un compte existe pour cette adresse, un lien de réinitialisation a
          été envoyé.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="mt-8 space-y-4"
        >
          <div>
            <Label>Adresse e-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input name="email" type="email" required placeholder="vous@exemple.com" className="pl-10" />
            </div>
          </div>
          <Button type="submit" variant="primary" className="w-full">
            Envoyer le lien
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-soft-pink hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </AuthShell>
  );
}
