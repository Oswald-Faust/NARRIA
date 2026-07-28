"use client";

/**
 * Indicateur de robustesse du mot de passe (correctif n° 17).
 *
 * Le minimum passe de 8 à 12 caractères. L'indicateur ne bloque pas la
 * soumission — c'est le rôle de la validation serveur — il rend seulement
 * visible ce qui manque, pendant la saisie.
 */

export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordCriterion {
  label: string;
  met: boolean;
}

export function evaluatePassword(password: string): {
  criteria: PasswordCriterion[];
  score: number;
  label: string;
} {
  const criteria: PasswordCriterion[] = [
    { label: `${PASSWORD_MIN_LENGTH} caractères minimum`, met: password.length >= PASSWORD_MIN_LENGTH },
    { label: "Une majuscule", met: /[A-ZÀ-Þ]/.test(password) },
    { label: "Un chiffre", met: /[0-9]/.test(password) },
    { label: "Un caractère spécial", met: /[^A-Za-zÀ-ÿ0-9]/.test(password) },
  ];
  const score = criteria.filter((c) => c.met).length;
  const label = ["Trop court", "Faible", "Moyen", "Bon", "Excellent"][score];
  return { criteria, score, label };
}

const BAR_COLORS = ["bg-border", "bg-red-500", "bg-yellow", "bg-soft-purple", "bg-green-500"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { criteria, score, label } = evaluatePassword(password);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" role="presentation">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step <= score ? BAR_COLORS[score] : "bg-border"
              }`}
            />
          ))}
        </div>
        <span className="text-[11px] font-semibold text-muted" aria-live="polite">
          {label}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {criteria.map((c) => (
          <li
            key={c.label}
            className={`text-[11px] leading-4 ${c.met ? "text-foreground/70" : "text-muted"}`}
          >
            <span aria-hidden>{c.met ? "✓" : "○"}</span> {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
