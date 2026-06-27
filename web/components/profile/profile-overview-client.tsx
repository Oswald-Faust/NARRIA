"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Sparkles, UserRound, Pencil, Shield, Lock, Mail, KeyRound, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { koba } from "@/lib/fonts";
import type { ProfileData } from "./types";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions";

function SecurityLink({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Lock;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-soft-pink/40"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold text-primary">Modifier →</span>
    </Link>
  );
}

export function ProfileOverviewClient({ initialProfile }: { initialProfile: ProfileData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState({
    nomComplet: initialProfile.nomComplet,
    profession: initialProfile.profession,
    narrativeSpecialty: initialProfile.narrativeSpecialty,
    country: initialProfile.country,
    langue: initialProfile.langue,
  });

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/profile/personal-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Impossible d'enregistrer les informations.");
      return;
    }
    const next = { ...profile, ...data.profile };
    setProfile(next);
    setForm({
      nomComplet: next.nomComplet,
      profession: next.profession,
      narrativeSpecialty: next.narrativeSpecialty,
      country: next.country,
      langue: next.langue,
    });
    setEditing(false);
    setMessage("Informations personnelles mises à jour.");
    startTransition(() => router.refresh());
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
    setMessage(null);
    setForm({
      nomComplet: profile.nomComplet,
      profession: profile.profession,
      narrativeSpecialty: profile.narrativeSpecialty,
      country: profile.country,
      langue: profile.langue,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-card)] bg-gradient-to-r from-[#24105a] to-[#4f38a0] px-6 py-6 text-white shadow-[0_12px_30px_rgba(33,13,78,0.12)] sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className={`${koba.className} text-3xl font-semibold tracking-wide sm:text-4xl`}>
              {profile.nomComplet}
            </h1>
            <p className="mt-1.5 text-sm text-white/80 sm:text-base">
              Auteur · Membre {profile.plan} depuis {profile.memberSince}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#6b26c6]/80 px-4 py-2 text-xs font-semibold text-white">
              <Crown className="h-3.5 w-3.5" />
              {profile.plan}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#7d4fc0]/80 px-4 py-2 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" />
              Narratologie computationnelle
            </div>
            <SignOutButton
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              label="Se déconnecter"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <Card className="bg-white p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <UserRound className="h-5 w-5 text-purple" />
              <h2 className="text-xl font-bold text-[#28214d]">Informations personnelles</h2>
            </div>
            {!editing ? (
              <Button
                variant="secondary"
                size="sm"
                className="self-start text-primary sm:self-auto"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={cancelEdit}>Annuler</Button>
                <Button variant="primary" size="sm" onClick={save} disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            )}
          </div>

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          {message && <p className="mb-4 text-sm text-emerald-500">{message}</p>}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label>Nom complet</Label>
              {editing ? (
                <Input value={form.nomComplet} onChange={(e) => setForm((s) => ({ ...s, nomComplet: e.target.value }))} />
              ) : (
                <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-foreground">{profile.nomComplet}</div>
              )}
            </div>
            <div>
              <Label>Adresse email</Label>
              <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-foreground">{profile.email}</div>
            </div>
            <div>
              <Label>Profession</Label>
              {editing ? (
                <Input value={form.profession} onChange={(e) => setForm((s) => ({ ...s, profession: e.target.value }))} />
              ) : (
                <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-foreground">{profile.profession}</div>
              )}
            </div>
            <div>
              <Label>Spécialité narrative</Label>
              {editing ? (
                <Input value={form.narrativeSpecialty} onChange={(e) => setForm((s) => ({ ...s, narrativeSpecialty: e.target.value }))} />
              ) : (
                <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-foreground">{profile.narrativeSpecialty}</div>
              )}
            </div>
            <div>
              <Label>Pays</Label>
              {editing ? (
                <Input value={form.country} onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))} />
              ) : (
                <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-foreground">{profile.country}</div>
              )}
            </div>
            <div>
              <Label>Langue principale</Label>
              {editing ? (
                <Input value={form.langue} onChange={(e) => setForm((s) => ({ ...s, langue: e.target.value }))} />
              ) : (
                <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-foreground">{profile.langue}</div>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <Shield className="h-5 w-5 text-purple" />
            <h2 className="text-xl font-bold text-[#28214d]">Sécurité</h2>
          </div>

          <div className="space-y-4">
            <SecurityLink icon={Lock} label="Mot de passe" href="/profil/mot-de-passe" />
            <SecurityLink icon={Mail} label={profile.recoveryEmail ? "Email de récupération" : "Ajouter un email de récupération"} href="/profil/email-recuperation" />
            <SecurityLink icon={KeyRound} label={profile.twoFactorEnabled ? "Double authentification activée" : "Double authentification"} href="/profil/double-authentification" />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <Card className="border-transparent bg-[#17083e] p-6 text-white shadow-[0_16px_36px_rgba(24,8,66,0.22)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-soft-pink" />
              <h2 className="text-xl font-bold">Abonnement {profile.plan}</h2>
            </div>
            <span className="rounded-full bg-[#6b26c6] px-3 py-1.5 text-xs font-semibold text-white">Actif</span>
          </div>
          <p className="text-sm text-white/85">Renouvellement le {profile.renewalDate}</p>
          <p className="mt-2 max-w-sm text-base leading-7 text-white/78">
            {profile.planTagline}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {profile.planFeatures.slice(0, 3).map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>
          <Button variant="primary" className="mt-6 w-full">
            <CreditCard className="h-4 w-4" />
            Gérer mon abonnement
          </Button>
        </Card>
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
            const active = profile.planId === plan.id;
            return (
              <Card
                key={plan.id}
                className={active ? "border-soft-pink/50 bg-surface shadow-[0_12px_32px_rgba(214,73,136,0.08)]" : "bg-white"}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-[#28214d]">{plan.label}</h3>
                  {active ? (
                    <span className="rounded-full bg-soft-pink/15 px-3 py-1 text-xs font-semibold text-soft-pink">
                      Actuel
                    </span>
                  ) : null}
                </div>
                <p className="min-h-12 text-sm text-muted">{plan.tagline}</p>
                <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">{plan.quotaDaily} actions / jour</p>
                  <p className="text-muted">{plan.quotaMonthly} actions / mois</p>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <Button variant={active ? "secondary" : "outline"} className="mt-5 w-full">
                  {active ? "Plan actif" : `Passer à ${plan.label}`}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
