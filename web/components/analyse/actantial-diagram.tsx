import { getActantialLayout, type MainActants } from "@/lib/reports/actantial-geometry";

interface ActantialDiagramProps {
  actants: MainActants;
}

const BOX_STYLES: Record<string, { stroke: string; fill: string; text: string }> = {
  destinateur: { stroke: "#f472b6", fill: "rgba(244,114,182,0.12)", text: "#f9a8d4" },
  destinataire: { stroke: "#f472b6", fill: "rgba(244,114,182,0.12)", text: "#f9a8d4" },
  objet: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.12)", text: "#c4b5fd" },
  sujet: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.12)", text: "#c4b5fd" },
  adjuvant: { stroke: "#9ca3af", fill: "rgba(156,163,175,0.10)", text: "#d1d5db" },
  opposant: { stroke: "#9ca3af", fill: "rgba(156,163,175,0.10)", text: "#d1d5db" },
};

export function ActantialDiagram({ actants }: ActantialDiagramProps) {
  const { dimensions, boxes } = getActantialLayout(actants);
  const { width: W, height: H, boxWidth: boxW, boxHeight: boxH } = dimensions;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" className="max-w-[560px]">
        <line x1={W / 2} y1={H - 80 - boxH / 2 - 5} x2={W / 2} y2={80 + boxH / 2 + 5} stroke="#a78bfa" strokeWidth={3} />
        <polygon points={`${W / 2 - 6},${80 + boxH / 2 + 10} ${W / 2 + 6},${80 + boxH / 2 + 10} ${W / 2},${80 + boxH / 2 + 2}`} fill="#a78bfa" />
        <text x={W / 2 + 10} y={H / 2} fontFamily="sans-serif" fontSize={9} fill="#a78bfa" fontWeight="bold">
          AXE DU DÉSIR
        </text>

        <line x1={130 + boxW / 2 + 5} y1={80} x2={W - 130 - boxW / 2 - 5} y2={80} stroke="#f472b6" strokeWidth={2} />
        <polygon points={`${W - 130 - boxW / 2 - 3},75 ${W - 130 - boxW / 2 - 3},85 ${W - 130 - boxW / 2 + 5},80`} fill="#f472b6" />
        <text x={W / 2} y={35} textAnchor="middle" fontFamily="sans-serif" fontSize={9} fill="#f472b6" fontWeight="bold">
          AXE DE COMMUNICATION
        </text>

        <line x1={130 + boxW / 2 + 5} y1={H - 80} x2={W / 2 - boxW / 2 - 5} y2={H - 80} stroke="#9ca3af" strokeWidth={2} />
        <polygon points={`${W / 2 - boxW / 2 - 3},${H - 85} ${W / 2 - boxW / 2 - 3},${H - 75} ${W / 2 - boxW / 2 + 5},${H - 80}`} fill="#9ca3af" />
        <line x1={W - 130 - boxW / 2 - 5} y1={H - 80} x2={W / 2 + boxW / 2 + 5} y2={H - 80} stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 3" />
        <polygon points={`${W / 2 + boxW / 2 + 3},${H - 85} ${W / 2 + boxW / 2 + 3},${H - 75} ${W / 2 + boxW / 2 - 5},${H - 80}`} fill="#9ca3af" />

        {boxes.map((box) => {
          const style = BOX_STYLES[box.key];
          const x = box.cx - boxW / 2;
          const y = box.cy - boxH / 2;
          return (
            <g key={box.key}>
              <rect x={x} y={y} width={boxW} height={boxH} rx={6} ry={6} fill={style.fill} stroke={style.stroke} strokeWidth={2} />
              <text x={box.cx} y={box.cy - 6} textAnchor="middle" fontFamily="sans-serif" fontSize={10} fill={style.stroke} fontWeight="bold">
                {box.label}
              </text>
              <text x={box.cx} y={box.cy + 14} textAnchor="middle" fontFamily="sans-serif" fontSize={11} fill={style.text} fontStyle="italic">
                {box.value}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-center text-xs italic text-muted">
        Schéma actantiel d&apos;après A. J. Greimas (Sémantique structurale, 1966).
      </p>
    </div>
  );
}
