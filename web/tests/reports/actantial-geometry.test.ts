import { describe, it, expect } from "vitest";
import { getActantialLayout, truncateActantLabel, ACTANTIAL_DIMENSIONS } from "@/lib/reports/actantial-geometry";

describe("ACTANTIAL_DIMENSIONS", () => {
  it("reproduit les dimensions exactes du SVG Python (W=720, H=360, boxW=140, boxH=50)", () => {
    expect(ACTANTIAL_DIMENSIONS).toEqual({ width: 720, height: 360, boxWidth: 140, boxHeight: 50 });
  });
});

describe("truncateActantLabel", () => {
  it("tronque à 22 caractères avec une ellipse, comme trunc() en Python", () => {
    const long = "Passion amoureuse réciproque et dévorante";
    expect(truncateActantLabel(long)).toBe("Passion amoureuse réc…");
    expect(truncateActantLabel(long).length).toBe(22);
  });

  it("retourne un tiret cadratin pour une valeur vide", () => {
    expect(truncateActantLabel("")).toBe("—");
    expect(truncateActantLabel(undefined)).toBe("—");
  });

  it("ne tronque pas une valeur déjà courte", () => {
    expect(truncateActantLabel("Roméo")).toBe("Roméo");
  });
});

describe("getActantialLayout", () => {
  it("place les 6 cartouches aux positions exactes du SVG Python", () => {
    const layout = getActantialLayout({
      protagoniste: "Roméo et Juliette",
      objet: "Union amoureuse malgré l'interdit familial",
      destinateur: "Passion amoureuse réciproque",
      destinataire: "Eux-mêmes",
      adjuvant: "Frère Laurent",
      opposant: "Haine familiale ancestrale",
    });
    const byKey = Object.fromEntries(layout.boxes.map((b) => [b.key, b]));
    expect(byKey.destinateur.cx).toBe(130);
    expect(byKey.destinateur.cy).toBe(80);
    expect(byKey.objet.cx).toBe(360);
    expect(byKey.objet.cy).toBe(80);
    expect(byKey.destinataire.cx).toBe(590);
    expect(byKey.destinataire.cy).toBe(80);
    expect(byKey.adjuvant.cx).toBe(130);
    expect(byKey.adjuvant.cy).toBe(280);
    expect(byKey.sujet.cx).toBe(360);
    expect(byKey.sujet.cy).toBe(280);
    expect(byKey.opposant.cx).toBe(590);
    expect(byKey.opposant.cy).toBe(280);
  });
});
