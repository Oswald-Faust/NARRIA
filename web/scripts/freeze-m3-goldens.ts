/**
 * Regèle les scores de comparaison (M3) du moteur révisé dans
 * `tests/engine/fixtures/golden-m3-v2.json`.
 *
 * À exécuter UNIQUEMENT après une modification intentionnelle du comparateur, et
 * après avoir vérifié que `tests/engine/discrimination-regression.test.ts` — le
 * harnais obligatoire du §5 de la note interne du 27/07/2026 — passe toujours.
 *
 *   npx vite-node -c vitest.config.ts scripts/freeze-m3-goldens.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeHeuristic, compare } from "../lib/engine";

const SAMPLES = ["romeo_juliette", "amants_conakry", "saison_pluies"] as const;
const root = join(__dirname, "..");

const graphs = Object.fromEntries(
  SAMPLES.map((id) => {
    const d = JSON.parse(readFileSync(join(root, "content/samples", `${id}.json`), "utf-8")) as {
      title: string;
      author: string;
      text: string;
    };
    return [id, analyzeHeuristic(d.text, { title: d.title, author: d.author })];
  }),
);

const out: Record<string, Record<string, number | string | boolean>> = {};
for (const a of SAMPLES) {
  for (const b of SAMPLES) {
    if (a === b) continue;
    const r = compare(graphs[a], graphs[b]);
    out[`${a}__vs__${b}`] = {
      sns: r.sns,
      ss: r.ss,
      st: r.st,
      srj: r.srj,
      s_iso: r.sIso,
      s_ged: r.sGed,
      s_func: r.sFunc,
      s_act: r.sAct,
      s_tens: r.sTens,
      srj_level: r.srjLevel,
      modality: r.detectedModality,
      coverage_ratio: r.coverage.ratio,
      alert: r.alert.triggered,
    };
  }
}

writeFileSync(join(root, "tests/engine/fixtures/golden-m3-v2.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`golden-m3-v2.json regelé — ${Object.keys(out).length} paires.`);
