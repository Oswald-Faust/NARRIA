/**
 * Harnais de non-régression exigé par les bêta-testeurs (point 4 du retour) :
 *
 *   « Institutionnaliser le test "œuvre contre elle-même" comme vérification
 *     systématique après toute modification du moteur, avec un seuil minimal
 *     exigé (par ex. SNS > 0,95) avant toute mise en production. »
 *
 * Trois propriétés y sont gelées, qu'aucune évolution du moteur ne doit rompre :
 *
 *   1. RÉFLEXIVITÉ — une œuvre comparée à elle-même vaut 1,0. Le moteur
 *      plafonnait à 0,829 : S_FUNC multipliait le recouvrement par la
 *      spécificité moyenne des fonctions, si bien qu'une identité stricte
 *      portant des fonctions courantes était pénalisée comme une divergence.
 *   2. DISCRIMINATION — l'acquis du §5 : une paire dérivée doit rester très
 *      au-dessus d'une paire indépendante.
 *   3. INCLUSION — une œuvre confrontée à son propre extrait doit être
 *      signalée, alors que son SNS est bas par construction.
 *
 * Ces tests ne consomment aucun appel au modèle de langage : ils portent sur le
 * comparateur seul, donc sur la part du moteur qui doit être déterministe.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeHeuristic, compare } from "@/lib/engine";
import type { NarrativeGraph } from "@/lib/engine";

/** Seuil de mise en production réclamé par les bêta-testeurs. */
const SELF_COMPARISON_MIN = 0.95;

const SAMPLES = ["romeo_juliette", "amants_conakry", "saison_pluies"] as const;

function loadSample(id: string) {
  const p = join(__dirname, "../../content/samples", `${id}.json`);
  return JSON.parse(readFileSync(p, "utf-8")) as { title: string; author: string; text: string };
}

const pairs = JSON.parse(
  readFileSync(join(__dirname, "fixtures/regression-pairs.json"), "utf-8"),
) as { pairA: { ref: NarrativeGraph; cand: NarrativeGraph }; pairB: { ref: NarrativeGraph; cand: NarrativeGraph } };

const clone = (g: NarrativeGraph) => JSON.parse(JSON.stringify(g)) as NarrativeGraph;

describe("Réflexivité — une œuvre comparée à elle-même", () => {
  for (const id of SAMPLES) {
    it(`${id} : SNS ≥ ${SELF_COMPARISON_MIN} et aucun nœud orphelin`, () => {
      const d = loadSample(id);
      const g = analyzeHeuristic(d.text, { title: d.title, author: d.author });
      const r = compare(g, clone(g), { texts: { ref: d.text, cand: d.text } });

      expect(r.sns).toBeGreaterThanOrEqual(SELF_COMPARISON_MIN);
      expect(r.coverage.refOrphans).toBe(0);
      expect(r.coverage.candOrphans).toBe(0);
    });
  }

  // Les graphes du harnais §5 portent des métadonnées actantielles, que les
  // graphes heuristiques n'ont pas : ils couvrent le chemin du mode LLM.
  for (const [label, g] of [
    ["pairA.ref", pairs.pairA.ref],
    ["pairB.cand", pairs.pairB.cand],
  ] as const) {
    it(`${label} : chaque composante du SNS vaut 1 sur une identité stricte`, () => {
      const r = compare(g, clone(g));
      for (const [name, value] of [
        ["S_ISO", r.sIso], ["S_GED", r.sGed], ["S_FUNC", r.sFunc],
        ["S_ACT", r.sAct], ["S_TENS", r.sTens],
      ] as const) {
        expect(value, `${name} doit valoir 1 sur une identité`).toBeCloseTo(1, 5);
      }
      expect(r.sns).toBeCloseTo(1, 5);
    });
  }
});

describe("Discrimination — l'acquis du §5 reste intact", () => {
  const A = compare(pairs.pairA.ref, pairs.pairA.cand);
  const B = compare(pairs.pairB.ref, pairs.pairB.cand);

  it("la paire dérivée domine largement la paire indépendante", () => {
    expect(A.sns - B.sns).toBeGreaterThan(0.3);
  });

  it("la paire indépendante ne déclenche ni alerte ni détection d'inclusion", () => {
    expect(B.alert.triggered).toBe(false);
    expect(B.inclusion.detected).toBe(false);
  });
});

describe("Inclusion — une œuvre contre son propre extrait", () => {
  const d = loadSample("romeo_juliette");
  const full = analyzeHeuristic(d.text, { title: d.title, author: d.author });

  for (const frac of [0.5, 0.25, 0.1]) {
    it(`extrait de ${Math.round(frac * 100)} % : signalé malgré un SNS abaissé`, () => {
      const part = clone(full);
      part.nodes = part.nodes.slice(0, Math.max(1, Math.round(full.nodes.length * frac)));
      const excerpt = d.text.slice(0, Math.max(400, Math.round(d.text.length * frac)));

      const r = compare(full, part, { texts: { ref: d.text, cand: excerpt } });

      expect(r.inclusion.detected).toBe(true);
      expect(r.inclusion.structural).toBeGreaterThanOrEqual(0.8);
      expect(r.inclusion.textual ?? 0).toBeGreaterThanOrEqual(0.5);
      expect(r.alert.triggered).toBe(true);
      // C'est tout l'intérêt de la mesure : le score symétrique, lui, s'effondre.
      expect(r.verdict).toContain("CONTENUE");
    });
  }
});
