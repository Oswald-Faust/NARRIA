/**
 * Harnais de non-régression du moteur narratologique.
 *
 * Compare la sortie du port TypeScript à la sortie de référence du moteur
 * Python (fixtures gelées dans `fixtures/golden.json`), sur les 3 samples,
 * en mode heuristique. Tant que les scores ne coïncident pas à ε près, le
 * port n'est pas considéré comme valide.
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

describe("Moteur — comparaison (M3) vs Python", () => {
  for (const a of SAMPLES) {
    for (const b of SAMPLES) {
      if (a === b) continue;
      it(`${a} → ${b} : SNS/SS/ST/SRJ + composantes + modalité`, () => {
        const r = compare(graphs[a], graphs[b]);
        const ref = golden.comparisons[`${a}__vs__${b}`];
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
      });
    }
  }
});
