import { cn } from "@/lib/utils";

/** Loader circulaire de la marque (anneau animé, accent rose). */
export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement en cours"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-border border-t-accent align-[-0.125em]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

/** Bloc de chargement centré (spinner + libellé optionnel), pour remplir une section. */
export function LoadingBlock({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12", className)}>
      <Spinner size={30} />
      {label ? <p className="text-sm text-muted">{label}</p> : null}
    </div>
  );
}
