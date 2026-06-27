"use client";

import { useMemo, useState } from "react";
import { Smartphone, MessageSquareText, ShieldAlert, ShieldCheck, Download, Shield, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ProfileHero, ProfileTopRow, ProfileWarning } from "./profile-shared";

export function TwoFactorClient({
  initialEnabled,
  initialMethod,
  initialPhoneNumber,
  initialBackupCodes,
}: {
  initialEnabled: boolean;
  initialMethod: string;
  initialPhoneNumber: string;
  initialBackupCodes: string[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [method, setMethod] = useState(initialMethod);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [backupCodes, setBackupCodes] = useState(initialBackupCodes);
  const [loadingApp, setLoadingApp] = useState(false);
  const [loadingSms, setLoadingSms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const statusLabel = enabled ? `Activé${method ? ` · ${method === "app" ? "Application" : "SMS"}` : ""}` : "Non activé";
  const hasCodes = backupCodes.length > 0;

  const formattedCodes = useMemo(
    () => (hasCodes ? backupCodes : ["K7X2-MN9P", "4RP8-TZ3J", "QW6V-BH1L", "YD5F-CX0A", "NE2G-SK7R"]),
    [backupCodes, hasCodes],
  );

  function downloadCodes() {
    const blob = new Blob([formattedCodes.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "narria-codes-secours.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function enableApp() {
    setLoadingApp(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/profile/2fa/app", { method: "POST" });
    const data = await res.json();
    setLoadingApp(false);
    if (!res.ok) {
      setError(data.error ?? "Impossible d'activer la 2FA par application.");
      return;
    }
    setEnabled(true);
    setMethod("app");
    setBackupCodes(data.backupCodes ?? []);
    setMessage("2FA par application activée.");
    router.refresh();
  }

  async function enableSms() {
    setLoadingSms(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/profile/2fa/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    const data = await res.json();
    setLoadingSms(false);
    if (!res.ok) {
      setError(data.error ?? "Impossible d'activer la 2FA par SMS.");
      return;
    }
    setEnabled(true);
    setMethod("sms");
    setPhoneNumber(data.phoneNumber ?? phoneNumber);
    setBackupCodes(data.backupCodes ?? []);
    setMessage("2FA par SMS activée.");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ProfileTopRow />
      <ProfileHero
        title="Double authentification (2FA)"
        subtitle="Ajoutez une couche de sécurité supplémentaire à votre compte NARR'IA."
        icon={<Smartphone className="h-6 w-6" />}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-500">{message}</p>}

      <Card className="bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-pink/15 text-soft-pink">
              {enabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {enabled ? "Double authentification activée" : "Double authentification désactivée"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {enabled ? "Votre compte dispose d'une couche de sécurité supplémentaire." : "Votre compte n'est protégé que par votre mot de passe."}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-soft-pink/15 text-soft-pink"}`}>
            {statusLabel}
          </span>
        </div>
      </Card>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Choisissez votre méthode d&apos;authentification</h2>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="bg-white p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0ff] text-primary">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Application d&apos;authentification</h3>
                  <p className="text-sm text-muted">Google Authenticator, Authy…</p>
                </div>
              </div>
              <span className="rounded-full bg-[#edeafc] px-3 py-1.5 text-xs font-semibold text-primary">Recommandé</span>
            </div>
            <p className="mb-5 text-base leading-8 text-muted">
              Scannez un QR code avec votre application pour générer des codes temporaires à 6 chiffres.
            </p>
            <Button variant="primary" className="w-full" onClick={enableApp} disabled={loadingApp}>
              <Shield className="h-4 w-4" />
              {loadingApp ? "Activation…" : "Activer la 2FA par application"}
            </Button>
          </Card>

          <Card className="bg-white p-6">
            <div className="mb-4 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4e8] text-yellow">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Code par SMS</h3>
                <p className="text-sm text-muted">Recevez un code par message</p>
              </div>
            </div>
            <p className="mb-4 text-base leading-8 text-muted">
              Recevez un code à 6 chiffres par SMS à chaque connexion. Nécessite un numéro de téléphone vérifié.
            </p>
            <div className="mb-4">
              <Label>Numéro de téléphone</Label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+33 6 00 00 00 00" />
            </div>
            <Button variant="outline" className="w-full border-yellow text-yellow hover:bg-yellow/10" onClick={enableSms} disabled={loadingSms}>
              <Send className="h-4 w-4" />
              {loadingSms ? "Activation…" : "Activer la 2FA par SMS"}
            </Button>
          </Card>
        </div>
      </section>

      <Card className="border-transparent bg-[#17083e] p-6 text-white">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Codes de secours</h2>
            <p className="mt-2 text-sm leading-7 text-white/72">
              Conservez ces codes dans un endroit sûr. Ils vous permettront d&apos;accéder à votre compte si vous perdez l&apos;accès à votre méthode 2FA.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/15" onClick={downloadCodes}>
            <Download className="h-4 w-4" />
            Télécharger
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {formattedCodes.map((code) => (
            <div key={code} className="rounded-xl bg-white/8 px-4 py-3 text-center text-lg font-semibold tracking-wide text-[#f7bf4f]">
              {code}
            </div>
          ))}
        </div>
      </Card>

      <ProfileWarning />
    </div>
  );
}
