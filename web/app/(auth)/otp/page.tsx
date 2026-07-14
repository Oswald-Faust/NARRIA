"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { koba } from "@/lib/fonts";

const OTP_PENDING_AUTH_KEY = "narria.pending-auth";

function OtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [digits, setDigits] = useState(["", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 4) refs.current[i + 1]?.focus();
  }

  async function verify() {
    setError(null);
    const code = digits.join("");
    if (code.length !== 5) {
      setError("Entrez les 5 chiffres.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Code incorrect.");
      return;
    }

    const pendingAuthRaw =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(OTP_PENDING_AUTH_KEY)
        : null;
    const pendingAuth = pendingAuthRaw ? JSON.parse(pendingAuthRaw) as {
      email?: string;
      password?: string;
    } : null;

    if (
      pendingAuth?.email?.toLowerCase() === email.toLowerCase() &&
      pendingAuth?.password
    ) {
      const login = await signIn("credentials", {
        email,
        password: pendingAuth.password,
        redirect: false,
      });

      if (!login?.error) {
        window.sessionStorage.removeItem(OTP_PENDING_AUTH_KEY);
        router.push("/accueil");
        return;
      }
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(OTP_PENDING_AUTH_KEY);
    }
    router.push("/login?verified=1");
  }

  return (
    <>
      <h2 className={`${koba.className} text-4xl font-semibold tracking-wide`}>Vérification</h2>
      <p className="mt-2 text-sm text-muted">
        Entrez le code à 5 chiffres envoyé à{" "}
        <span className="text-foreground">{email || "votre e-mail"}</span>.
      </p>

      <div className="mt-8 flex gap-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0)
                refs.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            maxLength={1}
            className="h-16 w-14 rounded-xl border border-border bg-surface-2 text-center font-heading text-2xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <Button
        onClick={verify}
        variant="primary"
        className="mt-8 w-full"
        disabled={loading}
      >
        {loading ? "Vérification…" : "Vérifier mon identité"}
      </Button>

      <p className="mt-5 text-center text-xs text-muted">
        Mauvais e-mail ?{" "}
        <Link href="/register" className="text-soft-pink hover:underline">
          Modifier mon adresse
        </Link>
      </p>
    </>
  );
}

export default function OtpPage() {
  return (
    <AuthShell
      badge="Vérification en deux étapes"
      title={
        <>
          Votre identité,
          <br />
          confirmée.
        </>
      }
      subtitle="Un code à 5 chiffres a été envoyé à votre adresse e-mail. Saisissez-le pour finaliser votre inscription."
    >
      <Suspense fallback={<LoadingBlock />}>
        <OtpForm />
      </Suspense>
    </AuthShell>
  );
}
