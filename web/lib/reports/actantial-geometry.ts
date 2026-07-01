/**
 * Géométrie pure du schéma actantiel greimassien — port de
 * `narria/app.py::_render_actantial_svg`. Consommée par le composant React
 * (thème sombre) et par le template d'export HTML (palette d'origine) : ne
 * pas dupliquer les positions ailleurs.
 */

export const ACTANTIAL_DIMENSIONS = { width: 720, height: 360, boxWidth: 140, boxHeight: 50 };

export type ActantKey = "destinateur" | "objet" | "destinataire" | "adjuvant" | "sujet" | "opposant";

export interface MainActants {
  protagoniste: string;
  objet: string;
  destinateur: string;
  destinataire: string;
  adjuvant: string;
  opposant: string;
}

export function truncateActantLabel(value: string | undefined, maxLen = 22): string {
  const s = (value ?? "").trim();
  if (!s) return "—";
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "…";
}

export interface ActantialBox {
  key: ActantKey;
  label: string;
  value: string;
  cx: number;
  cy: number;
}

export interface ActantialLayout {
  dimensions: typeof ACTANTIAL_DIMENSIONS;
  boxes: ActantialBox[];
}

export function getActantialLayout(actants: Partial<MainActants> | null | undefined): ActantialLayout {
  const safe = actants ?? {};
  const { width: W, height: H } = ACTANTIAL_DIMENSIONS;
  const topY = 80;
  const bottomY = H - 80; // 280

  const boxes: ActantialBox[] = [
    { key: "destinateur", label: "DESTINATEUR", value: truncateActantLabel(safe.destinateur), cx: 130, cy: topY },
    { key: "objet", label: "OBJET", value: truncateActantLabel(safe.objet), cx: W / 2, cy: topY },
    { key: "destinataire", label: "DESTINATAIRE", value: truncateActantLabel(safe.destinataire), cx: W - 130, cy: topY },
    { key: "adjuvant", label: "ADJUVANT", value: truncateActantLabel(safe.adjuvant), cx: 130, cy: bottomY },
    { key: "sujet", label: "SUJET", value: truncateActantLabel(safe.protagoniste), cx: W / 2, cy: bottomY },
    { key: "opposant", label: "OPPOSANT", value: truncateActantLabel(safe.opposant), cx: W - 130, cy: bottomY },
  ];

  return { dimensions: ACTANTIAL_DIMENSIONS, boxes };
}
