/**
 * Tableau de bord hors ligne du moteur de comparaison (aucun appel LLM).
 *
 * Surveille simultanément les deux exigences contradictoires :
 *  - RÉFLEXIVITÉ  : une œuvre comparée à elle-même doit tendre vers 1,0.
 *  - DISCRIMINATION : la paire A (dérivée) doit rester nettement au-dessus de
 *    la paire B (indépendante) — acquis du §5 à ne jamais dégrader.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeHeuristic, compare } from "../lib/engine";
import type { NarrativeGraph } from "../lib/engine/models";

function loadSample(id: string) {
  const p = join(__dirname, "../content/samples", `${id}.json`);
  return JSON.parse(readFileSync(p, "utf-8")) as { title: string; author: string; text: string };
}

const pairs = JSON.parse(
  readFileSync(join(__dirname, "../tests/engine/fixtures/regression-pairs.json"), "utf-8"),
) as { pairA: { ref: NarrativeGraph; cand: NarrativeGraph }; pairB: { ref: NarrativeGraph; cand: NarrativeGraph } };

function line(label: string, a: NarrativeGraph, b: NarrativeGraph) {
  const r = compare(a, b);
  const c = r.coverage;
  console.log(
    `${label.padEnd(30)} SNS=${r.sns.toFixed(3)}  ISO=${r.sIso.toFixed(3)}  GED=${r.sGed.toFixed(3)}  ` +
      `FUNC=${r.sFunc.toFixed(3)}  ACT=${r.sAct.toFixed(3)}  TENS=${r.sTens.toFixed(3)}` +
      `  | orphelins ${c?.refOrphans}/${c?.candOrphans}`,
  );
  return r.sns;
}

console.log("\n── RÉFLEXIVITÉ (objectif : SNS ≥ 0,95) ───────────────────────────────");
const samples = ["romeo_juliette", "amants_conakry", "saison_pluies"] as const;
const selfScores: number[] = [];
for (const id of samples) {
  const d = loadSample(id);
  const g = analyzeHeuristic(d.text, { title: d.title, author: d.author });
  const clone = JSON.parse(JSON.stringify(g)) as NarrativeGraph;
  selfScores.push(line(`${id} vs lui-même`, g, clone));
}
// Les paires du harnais, chacune comparée à elle-même : couvre le mode LLM
// (métadonnées actantielles présentes), que les samples heuristiques n'ont pas.
selfScores.push(line("pairA.ref vs lui-même", pairs.pairA.ref, pairs.pairA.ref));
selfScores.push(line("pairB.cand vs lui-même", pairs.pairB.cand, pairs.pairB.cand));

console.log("\n── DISCRIMINATION (§5 : A doit dominer B) ────────────────────────────");
const a = line("paire A — dérivée", pairs.pairA.ref, pairs.pairA.cand);
const b = line("paire B — indépendante", pairs.pairB.ref, pairs.pairB.cand);

console.log("\n── INCLUSION (une œuvre contre son propre extrait) ───────────────────");
const d = loadSample("romeo_juliette");
const g = analyzeHeuristic(d.text, { title: d.title, author: d.author });
for (const frac of [0.5, 0.25, 0.1]) {
  const t = JSON.parse(JSON.stringify(g)) as NarrativeGraph;
  t.nodes = t.nodes.slice(0, Math.max(1, Math.round(g.nodes.length * frac)));
  // Extrait réel du texte, pour exercer aussi la détection de reprise littérale.
  const excerpt = d.text.slice(0, Math.max(400, Math.round(d.text.length * frac)));
  const r = compare(g, t, { texts: { ref: d.text, cand: excerpt } });
  console.log(
    `extrait ${String(Math.round(frac * 100)).padStart(3)}%             SNS=${r.sns.toFixed(3)}  ` +
      `inclusion: structurelle=${r.inclusion.structural.toFixed(2)} ` +
      `littérale=${r.inclusion.textual?.toFixed(2) ?? "—"} ` +
      `détectée=${r.inclusion.detected ? "OUI" : "non"}  alerte=${r.alert.triggered ? "OUI" : "non"}`,
  );
}

console.log("\n── NON-INCLUSION (paire indépendante : ne doit RIEN déclencher) ─────");
{
  const r = compare(pairs.pairB.ref, pairs.pairB.cand);
  console.log(
    `paire B                  inclusion détectée=${r.inclusion.detected ? "OUI ✗" : "non ✓"}  ` +
      `alerte=${r.alert.triggered ? "OUI ✗" : "non ✓"}`,
  );
}

const worstSelf = Math.min(...selfScores);
console.log("\n── SYNTHÈSE ─────────────────────────────────────────────────────────");
console.log(`réflexivité, pire cas : ${worstSelf.toFixed(3)}   ${worstSelf >= 0.95 ? "✓" : "✗ < 0,95"}`);
console.log(`écart discriminant A−B : ${(a - b).toFixed(3)}   ${a - b > 0 ? "✓" : "✗ négatif"}`);
console.log("");
