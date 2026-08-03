/**
 * Banc de mesure de la variance d'extraction — harnais exécutable.
 *
 * Répond à l'objection des bêta-testeurs : l'outil produit-il UNE structure
 * narrative profonde, ou un nuage de structures possibles ? Le script lance k
 * extractions du même texte et publie les indicateurs de `stability.ts`.
 *
 * En mode A/B (défaut), il exécute la mesure DEUX fois — sans puis avec le
 * découpage déterministe en blocs — et met les deux rapports en regard. C'est
 * la seule façon de trancher empiriquement : le découpage stabilise-t-il
 * réellement l'extraction, ou déplace-t-il seulement le bruit ?
 *
 * ATTENTION : ce script consomme l'API Anthropic. Coût ≈ k × 2 extractions par
 * œuvre en mode A/B. Il attend `ANTHROPIC_API_KEY` dans l'environnement.
 *
 * Usage (via `npm run variance -- <options>`) :
 *   --a-sec              n'appelle PAS le modèle ; vérifie le déterminisme du
 *                        seul découpage. Gratuit, instantané, et suffisant pour
 *                        contrôler le harnais ou valider une non-régression.
 *   --passes 5           nombre d'extractions par mode (défaut : 3)
 *   --mode blocs         découpage seul  |  --mode sans-blocs : témoin seul
 *   --fichier oeuvre.txt mesure sur un texte à soi plutôt que sur les échantillons
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeLLM } from "../lib/engine/extraction/llm-extractor";
import {
  measureStability,
  formatStabilityReport,
  gradeStability,
  type StabilityReport,
} from "../lib/engine/extraction/stability";
import { splitIntoBlocks } from "../lib/engine/segmentation/block-splitter";
import type { LlmAnalysis, LlmNode } from "../lib/engine/extraction/llm-schema";
import type { NarrativeGraph, NarrativeNode } from "../lib/engine/models";

// ─── Arguments ───────────────────────────────────────────────────────────────

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PASSES = Math.max(2, Number(arg("passes", "3")));
const MODE = arg("mode", "ab") as "ab" | "blocs" | "sans-blocs";
const FICHIER = arg("fichier");
const A_SEC = process.argv.includes("--a-sec");
const ECHANTILLONS = ["romeo_juliette", "amants_conakry", "saison_pluies"] as const;

interface Oeuvre {
  id: string;
  title: string;
  author: string;
  text: string;
}

function chargerOeuvres(): Oeuvre[] {
  if (FICHIER) {
    return [{ id: FICHIER, title: FICHIER, author: "—", text: readFileSync(FICHIER, "utf-8") }];
  }
  return ECHANTILLONS.map((id) => {
    const brut = JSON.parse(
      readFileSync(join(__dirname, "../content/samples", `${id}.json`), "utf-8"),
    ) as { title: string; author: string; text: string };
    return { id, ...brut };
  });
}

// ─── Reconstruction d'une LlmAnalysis depuis le graphe produit ───────────────

/**
 * `analyzeLLM` retourne un NarrativeGraph ; les indicateurs de stabilité
 * travaillent sur des LlmAnalysis. La reprojection ne conserve que ce que les
 * indicateurs consultent — codes de fonction, ordre, coordonnées d'ancrage.
 */
function versAnalysis(graph: NarrativeGraph): LlmAnalysis {
  const nodes: LlmNode[] = graph.nodes.map((n: NarrativeNode, i) => ({
    sequence: i + 1,
    function_code: n.functionCode ?? "",
    function_name: n.functionName ?? "",
    function_family: n.functionFamily ?? "",
    actants: n.actants ?? [],
    modalities: n.modalities,
    tension: n.tension,
    phase: n.phase ?? "",
    text_excerpt: n.textExcerpt ?? "",
    justification: "",
    ...(n.blockStart !== undefined ? { block_start: n.blockStart, block_end: n.blockEnd } : {}),
    ...(n.charStart !== undefined ? { _char_start: n.charStart, _char_end: n.charEnd } : {}),
  }));

  return {
    summary: "", genre: "", tradition: "",
    formal_features: {
      form: "", register: "", narrative_length_category: "",
      approximate_word_count: 0, has_explicit_morality: false,
      has_narrator_intervention: false, uses_dialogue: false, stylistic_signature: "",
    },
    nodes,
    main_actants_v1: { _focus: "", _description: "", protagoniste: "", objet: "", destinateur: "", destinataire: "", adjuvant: "", opposant: "" },
    main_actants_v2: { _focus: "", _description: "", protagoniste: "", objet: "", destinateur: "", destinataire: "", adjuvant: "", opposant: "" },
    thematic_keywords: [],
  };
}

// ─── Exécution ───────────────────────────────────────────────────────────────

interface Mesure {
  rapport: StabilityReport;
  coutUsd: number;
}

async function mesurer(oeuvre: Oeuvre, avecBlocs: boolean): Promise<Mesure> {
  process.env.NARRIA_BLOCK_SPLIT = avecBlocs ? "on" : "off";

  const passes: LlmAnalysis[] = [];
  let coutUsd = 0;

  for (let p = 0; p < PASSES; p++) {
    process.stdout.write(`    passe ${p + 1}/${PASSES}… `);
    const { graph, usage } = await analyzeLLM(oeuvre.text, {
      title: oeuvre.title,
      author: oeuvre.author,
    });
    coutUsd += usage.costUsd;
    passes.push(versAnalysis(graph));
    process.stdout.write(`${graph.nodes.length} nœuds\n`);
  }

  return { rapport: measureStability(passes), coutUsd };
}

function comparerRapports(sans: StabilityReport, avec: StabilityReport): string {
  const delta = (a: number, b: number, sensPositif: boolean) => {
    const d = b - a;
    const signe = d > 0 ? "+" : "";
    const mieux = sensPositif ? d > 0 : d < 0;
    const marque = Math.abs(d) < 1e-9 ? "  =" : mieux ? " ✔" : " ✘";
    return `${signe}${(d * 100).toFixed(1)} pt${marque}`;
  };

  return [
    "",
    "── A/B : sans découpage → avec découpage ──",
    `Coeff. de variation   : ${(sans.nodeCountCv * 100).toFixed(1)} % → ${(avec.nodeCountCv * 100).toFixed(1)} %   ${delta(sans.nodeCountCv, avec.nodeCountCv, false)}`,
    `Accord fonctions      : ${(sans.functionJaccard * 100).toFixed(1)} % → ${(avec.functionJaccard * 100).toFixed(1)} %   ${delta(sans.functionJaccard, avec.functionJaccard, true)}`,
    `Accord positionnel    : ${(sans.positionalAgreement * 100).toFixed(1)} % → ${(avec.positionalAgreement * 100).toFixed(1)} %   ${delta(sans.positionalAgreement, avec.positionalAgreement, true)}`,
    `Recouvrement ancres   : ${sans.anchorIou === null ? "non mesurable" : `${(sans.anchorIou * 100).toFixed(1)} %`} → ${avec.anchorIou === null ? "non mesuré" : `${(avec.anchorIou * 100).toFixed(1)} %`}`,
    `Verdict               : ${gradeStability(sans).toUpperCase()} → ${gradeStability(avec).toUpperCase()}`,
  ].join("\n");
}

/**
 * Mode à sec : aucun appel au modèle. Vérifie que le découpage déterministe
 * l'est réellement — k découpages du même texte doivent être rigoureusement
 * identiques, blocs, frontières et règles comprises.
 *
 * C'est le seul volet de la chaîne dont la stabilité soit démontrable sans
 * dépenser un centime. Il ne dit rien de la stabilité de l'ÉTIQUETAGE, qui
 * reste, elle, à la charge du modèle et exige de vraies extractions.
 */
function mesurerASec(oeuvres: Oeuvre[]): number {
  let echecs = 0;

  for (const oeuvre of oeuvres) {
    const reference = splitIntoBlocks(oeuvre.text);
    const mots = oeuvre.text.trim().split(/\s+/).length;
    let identiques = 0;

    for (let p = 0; p < PASSES; p++) {
      const passe = splitIntoBlocks(oeuvre.text);
      if (JSON.stringify(passe) === JSON.stringify(reference)) identiques++;
    }

    const stable = identiques === PASSES;
    if (!stable) echecs++;

    const parRegle = new Map<string, number>();
    for (const bloc of reference) parRegle.set(bloc.rule, (parRegle.get(bloc.rule) ?? 0) + 1);
    const detail = [...parRegle.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([regle, n]) => `${regle} ${n}`)
      .join(", ");

    console.log(
      `${stable ? "✔" : "✘"} ${oeuvre.title}\n` +
        `    ${mots} mots → ${reference.length} blocs (${(mots / reference.length).toFixed(1)} mots/bloc)\n` +
        `    règles : ${detail}\n` +
        `    ${identiques}/${PASSES} découpages rigoureusement identiques`,
    );
  }

  return echecs;
}

async function main() {
  const oeuvresASec = chargerOeuvres();

  if (A_SEC) {
    console.log(
      `\nBanc de variance — mode à sec (aucun appel au modèle)\n` +
        `Contrôle du déterminisme du découpage sur ${PASSES} passes.\n`,
    );
    const echecs = mesurerASec(oeuvresASec);
    console.log(
      echecs === 0
        ? "\nDécoupage déterministe sur toutes les œuvres.\n" +
            "L'étiquetage des fonctions, lui, n'est pas mesuré ici : relancer sans --a-sec.\n"
        : `\n${echecs} œuvre(s) au découpage NON déterministe — régression.\n`,
    );
    process.exit(echecs === 0 ? 0 : 1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY absente de l'environnement. Ce banc effectue de vraies\n" +
        "extractions : sans clé, il ne peut rien mesurer.",
    );
    process.exit(1);
  }

  const oeuvres = oeuvresASec;
  const modes: { avecBlocs: boolean; libelle: string }[] =
    MODE === "blocs"
      ? [{ avecBlocs: true, libelle: "avec découpage" }]
      : MODE === "sans-blocs"
        ? [{ avecBlocs: false, libelle: "sans découpage" }]
        : [
            { avecBlocs: false, libelle: "sans découpage (témoin)" },
            { avecBlocs: true, libelle: "avec découpage" },
          ];

  console.log(
    `\nBanc de variance — ${PASSES} passes × ${modes.length} mode(s) × ${oeuvres.length} œuvre(s)\n` +
      `Soit ${PASSES * modes.length * oeuvres.length} extractions facturées.\n`,
  );

  let coutTotal = 0;

  for (const oeuvre of oeuvres) {
    const blocs = splitIntoBlocks(oeuvre.text);
    const mots = oeuvre.text.trim().split(/\s+/).length;
    console.log(`\n══ ${oeuvre.title} — ${mots} mots, ${blocs.length} blocs ══`);

    const resultats = new Map<boolean, StabilityReport>();
    for (const mode of modes) {
      console.log(`\n  ▸ ${mode.libelle}`);
      const { rapport, coutUsd } = await mesurer(oeuvre, mode.avecBlocs);
      coutTotal += coutUsd;
      resultats.set(mode.avecBlocs, rapport);
      console.log(
        formatStabilityReport(rapport, mode.libelle)
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
      );
    }

    const sans = resultats.get(false);
    const avec = resultats.get(true);
    if (sans && avec) {
      console.log(
        comparerRapports(sans, avec)
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
      );
    }
  }

  console.log(`\n\nCoût total des extractions : ${coutTotal.toFixed(4)} USD\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
