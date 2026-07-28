/**
 * Harnais de régression OBLIGATOIRE du moteur de comparaison.
 *
 * Exigé par le §5 de la note technique interne du 27 juillet 2026 : toute
 * nouvelle version du moteur doit satisfaire ces critères AVANT déploiement.
 *
 * Jeu de référence permanent : `fixtures/regression-pairs.json` — graphes
 * narratifs gelés reproduisant les deux paires des tests bêta des 26-27 juillet
 * 2026. Les textes des bêta-testeurs eux-mêmes ne sont pas réutilisés (note :
 * « Ne pas diffuser. Les textes des bêta-testeurs cités ne doivent pas être
 * réutilisés hors calibration »).
 *
 *   Paire A — œuvres dérivées : même univers, personnages communs, scènes
 *             reprises quasi mot pour mot. Un emprunt réel doit être détecté.
 *   Paire B — œuvres indépendantes : aucun univers, personnage, cadre ni genre
 *             commun, mais mêmes fonctions génériques (F13, F20, F22, F28, F31,
 *             F41), même arc tensif, tailles inégales. Aucune alerte ne doit
 *             être déclenchée.
 *
 * Le défaut d'origine : SNS(A) = 0,502 contre SNS(B) = 0,515 — le système
 * alarmait sur des œuvres sans lien tout en étant incapable de les distinguer
 * d'un cas d'emprunt avéré.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compare } from "@/lib/engine";
import type { NarrativeGraph } from "@/lib/engine";

interface Pair {
  label: string;
  ref: NarrativeGraph;
  cand: NarrativeGraph;
}
const fixtures = JSON.parse(
  readFileSync(join(__dirname, "fixtures/regression-pairs.json"), "utf-8"),
) as { pairA: Pair; pairB: Pair };

const A = compare(fixtures.pairA.ref, fixtures.pairA.cand);
const B = compare(fixtures.pairB.ref, fixtures.pairB.cand);

describe("§5 — critères de régression obligatoires", () => {
  it("SNS(paire A dérivée) − SNS(paire B indépendante) est strictement positif", () => {
    expect(A.sns - B.sns).toBeGreaterThan(0);
  });

  it("l'écart de discrimination dépasse la marge constatée avant correctifs (−0,013)", () => {
    // Repère gelé : la note relève SNS(A) 0,502 vs SNS(B) 0,515, soit un écart
    // NÉGATIF de 0,013. Toute version du moteur doit faire nettement mieux ;
    // le seuil ne doit être relevé qu'à la hausse, jamais abaissé.
    expect(A.sns - B.sns).toBeGreaterThan(0.3);
  });

  it("la paire B ne déclenche plus aucune alerte", () => {
    expect(B.alert.triggered).toBe(false);
  });

  it("la paire A conserve une détection (modalité de transformation identifiée)", () => {
    expect(B.detectedModality).toBe("Aucune modalité significative");
    expect(A.detectedModality).not.toBe("Aucune modalité significative");
    expect(A.detectedModality).not.toBe("Correspondance partielle non classifiée");
    expect(A.alert.triggered).toBe(true);
  });
});

describe("§3 — anomalies constatées, non-régression", () => {
  it("A1 — S_ISO n'est plus gonflé par les collisions d'étiquettes génériques", () => {
    // Les deux graphes de la paire B partagent F13, F20, F22, F28, F31 : sans
    // vérification de contenu, l'appariement était quasi total (S_ISO 0,713).
    expect(B.sIso).toBeLessThan(0.15);
    // La paire A, elle, reste massivement appariée.
    expect(A.sIso).toBeGreaterThan(0.8);
  });

  it("A3 / A5 — la couverture est publiée et la paire B est majoritairement orpheline", () => {
    expect(B.coverage.ratio).toBeLessThan(0.2);
    expect(B.coverage.refOrphans + B.coverage.candOrphans).toBeGreaterThan(15);
    expect(A.coverage.ratio).toBeGreaterThan(0.8);
  });

  it("A3 — la normalisation SNS_N n'accroît jamais le score en inter-genres", () => {
    expect(B.genre.crossGenre).toBe(true);
    expect(B.normalizationApplied).toBe(false);
    expect(B.snsNormalized).toBeLessThanOrEqual(B.sns);
    // Intra-genre, la normalisation reste appliquée.
    expect(A.normalizationApplied).toBe(true);
    expect(A.snsNormalized).toBeGreaterThanOrEqual(A.sns);
  });

  it("A4 — le verdict n'invoque « le même genre » que si les genres coïncident", () => {
    expect(B.verdict).not.toContain("dans le même genre");
    expect(B.verdict).toContain("Les genres détectés diffèrent");
    expect(B.warnings.some((w) => w.includes("Comparaison inter-genres"))).toBe(true);
  });

  it("A5 — l'appariement est injectif : aucun nœud ne sert deux fois", () => {
    for (const result of [A, B]) {
      const refNodes = result.correspondences.map((c) => c.refNode);
      const candNodes = result.correspondences.map((c) => c.candNode);
      expect(new Set(refNodes).size).toBe(refNodes.length);
      expect(new Set(candNodes).size).toBe(candNodes.length);
    }
  });

  it("P0-3 — chaque correspondance porte le contenu réel des deux nœuds", () => {
    expect(A.correspondences.length).toBeGreaterThan(0);
    for (const c of A.correspondences) {
      expect(c.refExcerpt.length).toBeGreaterThan(0);
      expect(c.candExcerpt.length).toBeGreaterThan(0);
      expect(c.refActants.length).toBeGreaterThan(0);
      expect(c.candActants.length).toBeGreaterThan(0);
      expect(c.contentSimilarity).toBeGreaterThanOrEqual(0.1);
    }
  });
});

describe("Propriétés structurelles du score", () => {
  it("le SNS est symétrique : comparer A à B ou B à A donne le même score", () => {
    // L'ancien dénominateur ne portait que sur le graphe candidat, d'où une
    // asymétrie sans justification narratologique.
    const direct = compare(fixtures.pairB.ref, fixtures.pairB.cand);
    const reverse = compare(fixtures.pairB.cand, fixtures.pairB.ref);
    expect(Math.abs(direct.sIso - reverse.sIso)).toBeLessThan(1e-9);
    expect(Math.abs(direct.coverage.ratio - reverse.coverage.ratio)).toBeLessThan(1e-9);
  });

  it("une œuvre comparée à elle-même sature les indicateurs", () => {
    const self = compare(fixtures.pairA.ref, fixtures.pairA.ref);
    expect(self.sIso).toBeGreaterThan(0.95);
    expect(self.coverage.ratio).toBe(1);
    expect(self.coverage.refOrphans).toBe(0);
  });

  it("le profil de poids v2-stabilized améliore la discrimination, sans être activé par défaut", () => {
    // Point 10 de la note : ne pas repondérer avant stabilisation de l'extraction.
    // Le profil est disponible et vérifié, mais `v1` reste le défaut.
    const a2 = compare(fixtures.pairA.ref, fixtures.pairA.cand, { weights: "v2-stabilized" });
    const b2 = compare(fixtures.pairB.ref, fixtures.pairB.cand, { weights: "v2-stabilized" });
    expect(a2.sns - b2.sns).toBeGreaterThan(A.sns - B.sns);
    expect(compare(fixtures.pairA.ref, fixtures.pairA.cand).sns).toBeCloseTo(A.sns, 10);
  });
});
