"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ProfileHero, ProfileTopRow, ProfileWarning } from "./profile-shared";

function ruleState(password: string) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function PasswordChangeClient({
  changedLabel,
}: {
  changedLabel: string;
}) {
  const router = useRouter();
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rules = ruleState(newPassword);
  const score = [rules.length, rules.uppercase, rules.special].filter(Boolean).length;
  const level = score <= 1 ? "Faible" : score === 2 ? "Moyen" : "Fort";

  async function submit() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Impossible de modifier le mot de passe.");
      return;
    }
    setMessage("Mot de passe mis à jour.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ProfileTopRow />
      <ProfileHero
        title="Modification du mot de passe"
        subtitle="Choisissez un mot de passe fort et unique pour protéger votre compte."
        icon={<Lock className="h-6 w-6" />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.66fr)]">
        <Card className="bg-white p-6">
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-5">
            <KeyRound className="h-5 w-5 text-purple" />
            <h2 className="text-xl font-bold text-foreground">Nouveau mot de passe</h2>
          </div>

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          {message && <p className="mb-4 text-sm text-emerald-500">{message}</p>}

          <div className="space-y-5">
            <div>
              <Label>Mot de passe actuel</Label>
              <div className="relative">
                <Input type={show.current ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••••••" className="pr-11" />
                <button type="button" onClick={() => setShow((s) => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {show.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Nouveau mot de passe</Label>
              <div className="relative">
                <Input type={show.next ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 caractères" className="pr-11" />
                <button type="button" onClick={() => setShow((s) => ({ ...s, next: !s.next }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {show.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirmer le nouveau mot de passe</Label>
              <div className="relative">
                <Input type={show.confirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Répétez le nouveau mot de passe" className="pr-11" />
                <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {show.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-surface-2 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Force du mot de passe</span>
                <span className="text-sm font-semibold text-yellow">{level}</span>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full ${i < score ? (i === 0 ? "bg-soft-pink" : i === 1 ? "bg-yellow" : "bg-emerald-400") : "bg-border"}`} />
                ))}
              </div>
              <div className="space-y-1.5 text-sm">
                <p className={rules.length ? "text-emerald-500" : "text-muted"}>✓ Au moins 8 caractères</p>
                <p className={rules.uppercase ? "text-emerald-500" : "text-muted"}>✓ Au moins une majuscule</p>
                <p className={rules.special ? "text-emerald-500" : "text-muted"}>✓ Au moins un caractère spécial</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.push("/profil")}>Annuler</Button>
              <Button variant="primary" onClick={submit} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer le mot de passe"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="max-w-[36rem] justify-self-end border-transparent bg-[#17083e] p-6 text-white">
          <div className="mb-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-purple-200" />
            <h2 className="text-xl font-bold">Conseils de sécurité</h2>
          </div>
          <p className="text-base leading-8 text-white/75">
            Utilisez un mélange de lettres majuscules et minuscules, de chiffres et de symboles. Évitez les informations personnelles comme votre date de naissance.
          </p>
          <div className="mt-6 rounded-xl bg-white/8 px-4 py-3 text-sm text-white/80">
            Dernier changement : {changedLabel}
          </div>
        </Card>
      </div>

      <ProfileWarning />
    </div>
  );
}
