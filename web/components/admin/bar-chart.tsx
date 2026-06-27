"use client";

/**
 * Mini graphe à barres empilées (SVG, sans dépendance) pour les séries
 * journalières du dashboard. Trois séries : analyses, comparaisons, chat.
 */
export interface SeriesPoint {
  date: string;
  count: number;
}

const COLORS = {
  analyses: "var(--color-soft-purple, #b794f6)",
  comparisons: "var(--color-soft-pink, #f687b3)",
  chat: "#38bdf8",
};

export function ActivityChart({
  analyses,
  comparisons,
  chat,
}: {
  analyses: SeriesPoint[];
  comparisons: SeriesPoint[];
  chat: SeriesPoint[];
}) {
  const n = analyses.length;
  const totals = analyses.map((_, i) =>
    (analyses[i]?.count ?? 0) + (comparisons[i]?.count ?? 0) + (chat[i]?.count ?? 0),
  );
  const max = Math.max(1, ...totals);

  const W = 720;
  const H = 200;
  const padB = 22;
  const gap = 6;
  const bw = (W - gap * (n - 1)) / n;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full min-w-[560px]" role="img" aria-label="Activité sur 14 jours">
        {analyses.map((p, i) => {
          const a = analyses[i]?.count ?? 0;
          const c = comparisons[i]?.count ?? 0;
          const ch = chat[i]?.count ?? 0;
          const usable = H - padB;
          const ha = (a / max) * usable;
          const hc = (c / max) * usable;
          const hch = (ch / max) * usable;
          const x = i * (bw + gap);
          let y = H - padB;
          const seg = (h: number, fill: string, key: string) => {
            y -= h;
            return h > 0 ? <rect key={key} x={x} y={y} width={bw} height={h} fill={fill} rx={1.5} /> : null;
          };
          const showLabel = n <= 16 || i % 2 === 0;
          return (
            <g key={p.date}>
              {seg(ha, COLORS.analyses, "a")}
              {seg(hc, COLORS.comparisons, "c")}
              {seg(hch, COLORS.chat, "ch")}
              {showLabel && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="fill-muted" fontSize="9">
                  {p.date.slice(8, 10)}/{p.date.slice(5, 7)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        <Legend color={COLORS.analyses} label="Analyses" />
        <Legend color={COLORS.comparisons} label="Comparaisons" />
        <Legend color={COLORS.chat} label="Requêtes IA" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> {label}
    </span>
  );
}
