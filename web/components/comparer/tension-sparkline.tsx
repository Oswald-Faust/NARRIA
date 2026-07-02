/**
 * TensionSparkline — port de `tension_bars` (narria/m5_reporting/reporter.py:64-72).
 * Barres verticales, hauteur = tension / max * 50 px, une barre de 12px par nœud.
 */

export interface TensionSparklineProps {
  profile: number[];
  /** Valeur CSS (ex. `var(--color-soft-purple)`) ou couleur pour les barres. */
  color: string;
}

export function TensionSparkline({ profile, color }: TensionSparklineProps) {
  if (!profile || profile.length === 0) return null;

  const maxT = Math.max(...profile);

  return (
    <div className="flex h-[60px] items-end gap-[2px] py-2">
      {profile.map((t, i) => {
        const h = maxT > 0 ? Math.round((t / maxT) * 50) : 0;
        return (
          <div
            key={i}
            className="w-3 rounded-t-sm"
            style={{ height: `${h}px`, background: color }}
          />
        );
      })}
    </div>
  );
}
