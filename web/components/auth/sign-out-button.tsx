"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SignOutButton({
  label = "Se déconnecter",
  callbackUrl = "/login",
  children,
  ...props
}: ButtonProps & {
  label?: string;
  callbackUrl?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await signOut({ callbackUrl });
  }

  return (
    <Button {...props} onClick={onClick} disabled={loading || props.disabled}>
      {children ?? <LogOut className="h-4 w-4" />}
      {label ? (loading ? "Déconnexion…" : label) : null}
    </Button>
  );
}
