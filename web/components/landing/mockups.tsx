import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────
   Mockups produit de la landing — purs JSX/SVG, aucun runtime client.
   Les animations (barres, anneaux) sont déclenchées par `.is-visible`
   posé par <Reveal/> sur un ancêtre.
   ──────────────────────────────────────────────────────────────────────── */

/** Cadre « navigateur » sombre autour d'un mockup. */
export function BrowserFrame({
  url = "narria.app/analyser",
  children,
  className,
}: {
  url?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#120a24] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/8 bg-white/4 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-auto flex h-6 max-w-xs flex-1 items-center justify-center rounded-md bg-white/6 px-3 text-[11px] text-white/45">
          {url}
        </div>
        <div className="w-10" />
      </div>
      {children}
    </div>
  );
}

/** Anneau de score SVG animé (pathLength=100 → offset = 100 − valeur). */
export function RingGauge({
  value,
  label,
  size = 120,
  stroke = 9,
  className,
}: {
  /** Score entre 0 et 1. */
  value: number;
  label?: string;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const pct = Math.round(value * 100);
  const r = 45;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="-rotate-90"
        aria-hidden
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={stroke} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#lp-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          className="lp-ring"
          style={{ "--off": `${100 - pct}` } as CSSProperties}
        />
        <defs>
          <linearGradient id="lp-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#da3861" />
            <stop offset="100%" stopColor="#f4ad5c" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-bold text-white">
          {value.toFixed(2).replace(".", ",")}
        </span>
        {label && <span className="text-[10px] font-medium uppercase tracking-widest text-white/50">{label}</span>}
      </div>
    </div>
  );
}

/** Barre horizontale animée d'un sous-score. */
export function ScoreBar({
  label,
  weight,
  value,
  color,
  delay = 0,
}: {
  label: string;
  weight: string;
  /** 0–1 */
  value: number;
  color: string;
  delay?: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-white/80">{label}</span>
        <span className="text-[11px] tabular-nums text-white/45">
          pondération {weight} · {value.toFixed(2).replace(".", ",")}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="lp-bar h-full rounded-full"
          style={{ width: `${value * 100}%`, background: color, "--d": `${delay}s` } as CSSProperties}
        />
      </div>
    </div>
  );
}

/** Mini schéma actantiel SVG (6 actants + flèches). */
export function ActantialDiagram({ className }: { className?: string }) {
  const node = (x: number, y: number, label: string, accent = false) => (
    <g>
      <rect
        x={x - 44}
        y={y - 13}
        width="88"
        height="26"
        rx="13"
        fill={accent ? "rgba(218,56,97,0.22)" : "rgba(255,255,255,0.06)"}
        stroke={accent ? "rgba(218,56,97,0.6)" : "rgba(255,255,255,0.14)"}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill={accent ? "#fc92a4" : "rgba(255,255,255,0.75)"}
      >
        {label}
      </text>
    </g>
  );
  const line = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(198,140,196,0.45)" strokeWidth="1.5" markerEnd="url(#lp-arrow)" />
  );
  return (
    <svg viewBox="0 0 380 150" className={cn("w-full", className)} role="img" aria-label="Schéma actantiel">
      <defs>
        <marker id="lp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(198,140,196,0.7)" />
        </marker>
      </defs>
      {line(104, 32, 142, 32)}
      {line(276, 32, 238, 32)}
      {line(104, 118, 142, 118)}
      {line(276, 118, 238, 118)}
      {line(190, 100, 190, 52)}
      {node(60, 32, "Destinateur")}
      {node(190, 32, "Objet", true)}
      {node(320, 32, "Destinataire")}
      {node(60, 118, "Adjuvant")}
      {node(190, 118, "Sujet", true)}
      {node(320, 118, "Opposant")}
    </svg>
  );
}

/** Puce de fonction narrative (FN12 · Interdiction…). */
function FnChip({ code, label, accent = false }: { code: string; label: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        accent
          ? "border-yellow/40 bg-yellow/12 text-yellow"
          : "border-white/12 bg-white/5 text-white/70",
      )}
    >
      <span className={cn("font-heading font-bold", accent ? "text-yellow" : "text-soft-purple")}>{code}</span>
      {label}
    </span>
  );
}

/* ── Mockup principal : rapport d'analyse ─────────────────────────────── */
export function AnalysisMockup() {
  return (
    <BrowserFrame url="narria.app/analyser/rapport">
      <div className="grid gap-0 md:grid-cols-[190px_1fr]">
        {/* Sidebar miniature */}
        <aside className="hidden flex-col gap-1 border-r border-white/8 bg-gradient-to-b from-[#3a1d63]/60 to-[#1a0e35]/80 p-4 md:flex">
          <div className="mb-3 font-display text-sm tracking-wide text-white">narr&apos;ia</div>
          {["Accueil", "Chat", "Analyser", "Comparer", "Répertoire", "Historique"].map((item, i) => (
            <div
              key={item}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px]",
                i === 2 ? "bg-pink/25 font-semibold text-white" : "text-white/50",
              )}
            >
              {item}
            </div>
          ))}
        </aside>

        {/* Rapport */}
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-soft-purple">
                Rapport d&apos;analyse
              </div>
              <div className="mt-1 font-heading text-lg font-bold text-white">Le Pacte des ombres</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <FnChip code="Genre" label="Conte merveilleux" />
                <FnChip code="Tradition" label="Afrique de l'Ouest" accent />
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
              <RingGauge value={0.87} label="SNS" size={84} stroke={10} />
              <div className="max-w-[130px]">
                <div className="text-[12px] font-semibold text-soft-pink">Similarité forte</div>
                <div className="mt-0.5 text-[11px] leading-4 text-white/50">
                  Seuil d&apos;appariement 0,40 largement dépassé
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Séquence narrative détectée
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FnChip code="FN1" label="Situation initiale" />
                <FnChip code="FN8" label="Méfait" accent />
                <FnChip code="FN12" label="Épreuve" />
                <FnChip code="FN15" label="Déplacement" />
                <FnChip code="FN31" label="Mariage" />
                <FnChip code="FN47" label="Palabre" accent />
              </div>
              <div className="mt-4 space-y-3">
                <ScoreBar label="Isomorphisme" weight="0,25" value={0.91} color="#da3861" delay={0.1} />
                <ScoreBar label="Fonctions partagées" weight="0,25" value={0.84} color="#c68cc4" delay={0.25} />
                <ScoreBar label="Tension dramatique" weight="0,15" value={0.78} color="#f4ad5c" delay={0.4} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Schéma actantiel
              </div>
              <ActantialDiagram />
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ── Mockup chat (agent conversationnel) ──────────────────────────────── */
export function ChatMockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 text-[13px] leading-5", className)}>
      <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-pink/85 px-3.5 py-2.5 text-white shadow-lg">
        Ce manuscrit reprend-il la structure du conte de la calebasse d&apos;or&nbsp;?
      </div>
      <div className="max-w-[90%] self-start rounded-2xl rounded-bl-md border border-white/10 bg-white/6 px-3.5 py-2.5 text-white/85">
        <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-soft-purple/40 bg-soft-purple/15 px-2 py-0.5 text-[10px] font-semibold text-soft-purple">
          <span className="lp-pulse h-1.5 w-1.5 rounded-full bg-soft-purple" />
          outil · comparerTextes
        </span>
        <p>
          Oui, très probablement. Le score <strong className="text-soft-pink">SNS atteint 0,87</strong>,
          bien au-delà du seuil de 0,40 : 6 fonctions narratives sur 8 sont appariées, dont le
          méfait initial et la triple épreuve…
        </p>
      </div>
      <div className="inline-flex items-center gap-1 self-start rounded-full border border-white/10 bg-white/6 px-3 py-2">
        <span className="lp-dot h-1.5 w-1.5 rounded-full bg-white/70" />
        <span className="lp-dot h-1.5 w-1.5 rounded-full bg-white/70" />
        <span className="lp-dot h-1.5 w-1.5 rounded-full bg-white/70" />
      </div>
    </div>
  );
}

/* ── Mockup projet (espace de travail collaboratif) ───────────────────── */
const MEMBERS = [
  { initials: "FO", color: "#843b90" },
  { initials: "AK", color: "#da3861" },
  { initials: "SL", color: "#f4ad5c" },
];

export function ProjectMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-white/10 bg-[#120a24] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.65)]",
        className,
      )}
    >
      {/* En-tête projet */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-white/4 px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-soft-purple">Projet</div>
          <div className="mt-0.5 font-heading text-[15px] font-bold text-white">
            Affaire Kaïros ⁄ Éditions Lumen
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-2">
            {MEMBERS.map((m) => (
              <span
                key={m.initials}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#120a24] text-[9px] font-bold text-white"
                style={{ background: m.color }}
              >
                {m.initials}
              </span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/70">
            <span className="lp-pulse h-1.5 w-1.5 rounded-full bg-[#28c840]" />3 en ligne
          </span>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-white/8 px-5 pt-3">
        {["Analyses", "Comparaisons", "Chat", "Exports"].map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "rounded-t-lg px-3 py-2 text-[12px] font-medium",
              i === 0
                ? "border-b-2 border-pink font-semibold text-white"
                : "text-white/45",
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Contenu */}
      <div className="space-y-2.5 p-5">
        {[
          { title: "Manuscrit — Le Pacte des ombres", meta: "analysé par FO · hier", chip: "SNS 0,87", tone: "pink" },
          { title: "Comparaison v2 ↔ roman publié", meta: "lancée par AK · il y a 4 min", chip: "en cours", tone: "live" },
          { title: "Rapport d'expertise — synthèse", meta: "exporté en PDF · partagé", chip: "✓ prêt", tone: "ok" },
        ].map((row) => (
          <div
            key={row.title}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-3.5 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-white/90">{row.title}</div>
              <div className="text-[10.5px] text-white/40">{row.meta}</div>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                row.tone === "pink" && "bg-pink/20 text-soft-pink",
                row.tone === "live" && "bg-yellow/15 text-yellow",
                row.tone === "ok" && "bg-[#28c840]/15 text-[#5fdd82]",
              )}
            >
              {row.tone === "live" && <span className="lp-pulse h-1.5 w-1.5 rounded-full bg-yellow" />}
              {row.chip}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mockup comparaison (2 textes → appariement) ──────────────────────── */
export function CompareMockup({ className }: { className?: string }) {
  const rows = [
    { a: "FN8 · Méfait", b: "FN8 · Méfait", v: 0.96 },
    { a: "FN12 · Épreuve", b: "FN13 · Réaction", v: 0.71 },
    { a: "FN31 · Mariage", b: "FN31 · Mariage", v: 0.89 },
  ];
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
        <span>Texte A</span>
        <span />
        <span className="text-right">Texte B</span>
      </div>
      {rows.map((r) => (
        <div key={r.a} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="truncate rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/75">
            {r.a}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
              r.v > 0.8 ? "bg-pink/20 text-soft-pink" : "bg-yellow/15 text-yellow",
            )}
          >
            {Math.round(r.v * 100)}%
          </span>
          <span className="truncate rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-right text-[11px] text-white/75">
            {r.b}
          </span>
        </div>
      ))}
      <div className="pt-1">
        <div className="mb-1 flex justify-between text-[11px]">
          <span className="font-semibold text-white/70">Score SNS global</span>
          <span className="font-bold text-soft-pink">0,87</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="lp-bar h-full rounded-full bg-gradient-to-r from-purple via-pink to-yellow"
            style={{ width: "87%" }}
          />
        </div>
      </div>
    </div>
  );
}
