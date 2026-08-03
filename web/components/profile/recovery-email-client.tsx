"use client";

import { useState } from "react";
import { Mail, Info, AtSign, Eye, EyeOff, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ProfileHero, ProfileTopRow, ProfileWarning } from "./profile-shared";

export function RecoveryEmailClient({
  currentEmail,
}: {
  currentEmail: string;
}) {
  const router = useRouter();
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [confirmRecoveryEmail, setConfirmRecoveryEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/profile/recovery-email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryEmail, confirmRecoveryEmail, currentPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Impossible d'enregistrer l'e-mail.");
      return;
    }
    setMessage("E-mail de récupération mis à jour.");
    setRecoveryEmail(data.recoveryEmail ?? recoveryEmail);
    setConfirmRecoveryEmail("");
    setCurrentPassword("");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ProfileTopRow />
      <ProfileHero
        title="Modification de l'email de récupération"
        subtitle="Cet email sera utilisé pour récupérer votre compte en cas de perte d'accès."
        icon={<Mail className="h-6 w-6" />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.66fr)]">
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-5">
            <Mail className="h-5 w-5 text-purple" />
            <h2 className="text-xl font-bold text-foreground">Nouvel email de récupération</h2>
          </div>

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          {message && <p className="mb-4 text-sm text-emerald-500">{message}</p>}

          <div className="space-y-5">
            <div className="rounded-xl bg-surface-2 px-4 py-4">
              <p className="text-xs font-medium text-muted">Email actuel</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{currentEmail}</p>
            </div>

            <div>
              <Label>Nouvel email de récupération</Label>
              <div className="relative">
                <Input value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="nouveau@exemple.com" className="pr-11" />
                <AtSign className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div>
              <Label>Confirmer le nouvel email</Label>
              <div className="relative">
                <Input value={confirmRecoveryEmail} onChange={(e) => setConfirmRecoveryEmail(e.target.value)} placeholder="Répétez le nouvel email" className="pr-11" />
                <AtSign className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div>
              <Label>Confirmer avec votre mot de passe actuel</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••••••" className="pr-11" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.push("/profil")}>Annuler</Button>
              <Button variant="primary" onClick={submit} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Enregistrement…" : "Enregistrer l'email"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="max-w-[36rem] justify-self-end border-transparent bg-[#17083e] p-6 text-white">
          <div className="mb-4 flex items-center gap-3">
            <Info className="h-5 w-5 text-purple-200" />
            <h2 className="text-xl font-bold">À quoi sert cet email ?</h2>
          </div>
          <p className="text-base leading-8 text-white/75">
            L&apos;email de récupération vous permet de réaccéder à votre compte si vous oubliez votre mot de passe ou perdez l&apos;accès à votre email principal.
          </p>
          <div className="mt-6 space-y-3">
            {[
              "Entrez votre nouvel email de récupération",
              "Un email de vérification vous sera envoyé",
              "Cliquez sur le lien pour confirmer le changement",
            ].map((step, i) => (
              <div key={step} className="flex items-start gap-3 rounded-xl bg-white/8 px-4 py-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-soft-purple text-sm font-bold text-white">{i + 1}</span>
                <p className="text-sm leading-6 text-white/80">{step}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <ProfileWarning />
    </div>
  );
}
