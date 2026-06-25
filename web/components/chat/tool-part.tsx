import { ScanText, GitCompareArrows, BookMarked, Loader2, Check } from "lucide-react";

/** Métadonnées d'affichage par outil de l'agent. */
const TOOL_META: Record<string, { label: string; icon: typeof ScanText }> = {
  "tool-analyserStructure": { label: "Analyse de la structure narrative", icon: ScanText },
  "tool-comparerTextes": { label: "Comparaison de deux textes", icon: GitCompareArrows },
  "tool-consulterRepertoire": { label: "Consultation du répertoire", icon: BookMarked },
};

/**
 * Carte compacte indiquant qu'un outil du moteur NARR'IA a été invoqué
 * pendant la réponse — état « en cours » puis « terminé ».
 */
export function ToolPart({ type, state }: { type: string; state: string }) {
  const meta = TOOL_META[type] ?? { label: "Outil NARR'IA", icon: ScanText };
  const Icon = meta.icon;
  const done = state === "output-available";
  const errored = state === "output-error";

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
      <Icon className="h-4 w-4 text-soft-purple" />
      <span className="font-medium text-foreground">{meta.label}</span>
      {errored ? (
        <span className="text-red-400">échec</span>
      ) : done ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-soft-pink" />
      )}
    </div>
  );
}
