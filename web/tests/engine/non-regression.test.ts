/**
 * Harnais de non-régression du moteur narratologique.
 *
 * Compare la sortie du port TypeScript à la sortie de référence du moteur
 * Python (fixtures gelées dans `fixtures/golden.json`), sur les 3 samples,
 * en mode heuristique.
 *
 * PORTÉE RÉDUITE DEPUIS LE 28/07/2026. Ce harnais ne couvre plus que les
 * modules M1 (segmentation) et M2 (extraction heuristique), inchangés.
 *
 * La parité avec le module M3 (comparaison) est VOLONTAIREMENT rompue : les
 * correctifs P0/P1/P2 de la note interne du 27/07/2026 modifient le calcul du
 * SNS et de ses composantes (IDF fonctionnel, seuil de contenu, appariement
 * injectif, pénalité d'orphelins, normalisation conditionnée). Le moteur Python
 * présente le déficit de pouvoir discriminant que ces correctifs suppriment :
 * s'aligner sur lui reviendrait à réintroduire le défaut.
 *
 * Le harnais qui fait désormais autorité sur M3 est
 * `discrimination-regression.test.ts` (§5 de la note). Les scores de comparaison
 * du moteur révisé sont gelés dans `fixtures/golden-m3-v2.json`, régénérables
 * par `npx vite-node -c vitest.config.ts scripts/freeze-m3-goldens.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeHeuristic, compare, functionSequence, tensionProfile } from "@/lib/engine";

const SAMPLES = ["romeo_juliette", "amants_conakry", "saison_pluies"] as const;
const EPS = 1e-6;

const golden = JSON.parse(
  readFileSync(join(__dirname, "fixtures/golden.json"), "utf-8"),
) as {
  analyses: Record<string, { n_nodes: number; function_sequence: string[]; tension_profile: number[] }>;
  comparisons: Record<string, Record<string, number | string>>;
};

const goldenM3 = JSON.parse(
  readFileSync(join(__dirname, "fixtures/golden-m3-v2.json"), "utf-8"),
) as Record<string, Record<string, number | string | boolean>>;

function loadSample(id: string) {
  const p = join(__dirname, "../../content/samples", `${id}.json`);
  return JSON.parse(readFileSync(p, "utf-8")) as { title: string; author: string; text: string };
}

const graphs = Object.fromEntries(
  SAMPLES.map((id) => {
    const d = loadSample(id);
    return [id, analyzeHeuristic(d.text, { title: d.title, author: d.author })];
  }),
);

describe("Moteur — analyse (M1+M2) vs Python", () => {
  for (const id of SAMPLES) {
    it(`${id} : nombre de nœuds + séquence de fonctions + profil tensif`, () => {
      const g = graphs[id];
      const ref = golden.analyses[id];
      expect(g.nodes.length).toBe(ref.n_nodes);
      expect(functionSequence(g)).toEqual(ref.function_sequence);
      const tens = tensionProfile(g);
      expect(tens.length).toBe(ref.tension_profile.length);
      tens.forEach((t, i) => expect(Math.abs(t - ref.tension_profile[i])).toBeLessThan(EPS));
    });
  }
});

/**
 * Comparaison (M3) : gel des scores du moteur révisé. La référence n'est plus
 * le moteur Python (cf. en-tête) mais la sortie figée du moteur corrigé — toute
 * dérive non intentionnelle est détectée, sans réintroduire le défaut d'origine.
 */
describe("Moteur — comparaison (M3), scores gelés du moteur révisé", () => {
  for (const a of SAMPLES) {
    for (const b of SAMPLES) {
      if (a === b) continue;
      it(`${a} → ${b} : SNS/SS/ST/SRJ + composantes + modalité`, () => {
        const r = compare(graphs[a], graphs[b]);
        const ref = goldenM3[`${a}__vs__${b}`];
        const num: [number, keyof typeof ref][] = [
          [r.sns, "sns"], [r.ss, "ss"], [r.st, "st"], [r.srj, "srj"],
          [r.sIso, "s_iso"], [r.sGed, "s_ged"], [r.sFunc, "s_func"],
          [r.sAct, "s_act"], [r.sTens, "s_tens"],
        ];
        for (const [got, key] of num) {
          expect(Math.abs(got - (ref[key] as number))).toBeLessThan(EPS);
        }
        expect(r.srjLevel).toBe(ref.srj_level);
        expect(r.detectedModality).toBe(ref.modality);
        expect(r.coverage.ratio).toBeCloseTo(ref.coverage_ratio as number, 6);
        expect(r.alert.triggered).toBe(ref.alert);
      });
    }
  }

  it("le moteur révisé discrimine mieux que le moteur Python sur ces mêmes samples", () => {
    // Repère : Python attribuait 0,632 à romeo_juliette → amants_conakry et 0,572
    // à romeo_juliette → saison_pluies, soit 0,060 d'écart entre une paire liée et
    // une paire sans lien. Le moteur révisé doit creuser cet écart.
    const lie = compare(graphs.romeo_juliette, graphs.amants_conakry).sns;
    const sansLien = compare(graphs.romeo_juliette, graphs.saison_pluies).sns;
    expect(lie - sansLien).toBeGreaterThan(0.06);
  });
});
