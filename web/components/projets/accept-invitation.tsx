"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function AcceptInvitationActions({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/invitations/${token}/accept`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Impossible de rejoindre le projet.");
        setLoading(false);
        return;
      }
      router.push(`/projets/${data.projectId}`);
      router.refresh();
    } catch {
      setError("Une erreur réseau est survenue. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" className="flex-1 justify-center" onClick={accept} disabled={loading}>
          {loading ? <Spinner size={16} className="border-white/40 border-t-white" /> : <Check className="h-4 w-4" />}
          {loading ? "Ajout en cours…" : "Rejoindre le projet"}
        </Button>
        <Link href="/projets" className="flex-1">
          <Button variant="secondary" className="w-full justify-center">Plus tard</Button>
        </Link>
      </div>
    </div>
  );
}
