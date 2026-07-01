import crypto from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";

/** Génère un code OTP numérique à 5 chiffres (écran « Vérification »). */
export function generateOtp(): string {
  return String(crypto.randomInt(0, 100000)).padStart(5, "0");
}

/** Expiration de l'OTP : 10 minutes. */
export function otpExpiry(): Date {
  return new Date(Date.now() + 10 * 60 * 1000);
}

// ── 2FA TOTP (application authenticator) — otplib v13 functional API ─────
export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return generateURI({ issuer: "NARR'IA", label: email, secret });
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return verifySync({ token, secret }).valid;
  } catch {
    return false;
  }
}

/** Génère N codes de secours (téléchargeables sur l'écran 2FA). */
export function generateBackupCodes(n = 8): string[] {
  return Array.from({ length: n }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase(),
  );
}
