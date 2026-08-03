/**
 * Détection de condensation par alignement séquentiel.
 *
 * Répond au point central du retour des bêta-testeurs : « l'outil devrait être
 * capable de détecter la condensation en cherchant si l'œuvre candidate est un
 * sous-graphe de l'œuvre source ». Le couplage biparti injectif de S_ISO en est
 * incapable par construction — un nœud candidat n'y explique qu'un seul nœud de
 * référence. Ces tests vérifient que l'alignement, lui, y parvient, et qu'il ne
 * détecte pas de condensation là où il n'y en a pas.
 */
import { describe, it, expect } from "vitest";
import { alignSequences } from "@/lib/engine/comparison/condensation";
import { nodeSimilarity, compare } from "@/lib/engine/comparison/comparator";
import { contentSimilarity } from "@/lib/engine/comparison/content-similarity";
import type { NarrativeGraph, NarrativeNode } from "@/lib/engine/models";

let compteur = 0;

function node(
  functionCode: string,
  textExcerpt: string,
  actants: string[] = [],
): NarrativeNode {
  compteur++;
  return {
    nodeId: `n${compteur}`,
    segmentId: `s${compteur}`,
    functionCode,
    functionFamily: functionCode.slice(0, 2),
    functionName: functionCode,
    actants,
    modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
    tension: 0.5,
    phase: "Complication",
    textExcerpt,
  };
}

function graph(nodes: NarrativeNode[]): NarrativeGraph {
  return { graphId: `g${compteur}`, metadata: {}, nodes, edges: [] };
}

const options = { contentSimilarity, labelSimilarity: nodeSimilarity };
const align = (a: NarrativeGraph, b: NarrativeGraph) => alignSequences(a, b, options);

describe("Correspondance un-pour-un", () => {
  it("aligne deux graphes identiques intégralement", () => {
    const nodes = [
      node("F01", "le prince quitte le royaume paternel", ["prince"]),
      node("F20", "le prince affronte le dragon des marais", ["prince", "dragon"]),
      node("F41", "le prince triomphe et rentre couronné", ["prince"]),
    ];
    const a = graph(nodes);
    const resultat = align(a, graph([...nodes]));

    expect(resultat.containment).toBe(1);
    expect(resultat.condensedSteps).toBe(0);
    expect(resultat.condensationRatio).toBe(1);
    expect(resultat.direction).toBeNull();
    expect(resultat.steps.every((s) => s.kind === "correspondance")).toBe(true);
  });

  it("respecte l'ordre du récit", () => {
    // Épisodes lexicalement disjoints, actants distincts : sans quoi la mesure
    // de contenu, qui retient le maximum entre extrait et actants, saturerait à
    // 1 partout et n'exercerait plus aucune discrimination.
    const suite = [
      node("F01", "départ du prince vers la montagne enneigée", ["prince"]),
      node("F20", "combat du soldat contre le géant de pierre", ["soldat", "géant"]),
      node("F41", "couronnement de la reine devant le peuple", ["reine", "peuple"]),
    ];
    const inverse = [suite[2], suite[1], suite[0]].map((n) => ({ ...n, nodeId: `${n.nodeId}b` }));

    const direct = align(graph(suite), graph([...suite]));
    const permute = align(graph(suite), graph(inverse));

    expect(direct.containment).toBe(1);
    // Un alignement monotone ne peut retenir qu'une sous-séquence croissante :
    // sur un ordre inversé, un seul épisode sur trois peut être expliqué.
    expect(permute.containment).toBeLessThan(direct.containment);
    expect(permute.containment).toBeCloseTo(1 / 3, 6);
  });
});

describe("Condensation — le cas visé par les bêta-testeurs", () => {
  // Source : six épisodes détaillés. Candidat : trois épisodes qui les résument
  // deux à deux, en reprenant le vocabulaire de chacun.
  const source = graph([
    node("F01", "le marchand quitte la ville au matin", ["marchand"]),
    node("F13", "le marchand traverse le désert pendant des jours", ["marchand"]),
    node("F20", "le marchand affronte les brigands de la passe", ["marchand", "brigands"]),
    node("F24", "le marchand blessé perd sa caravane", ["marchand"]),
    node("F40", "le marchand libère les captifs de la citadelle", ["marchand", "captifs"]),
    node("F41", "le marchand triomphe et rentre chez lui", ["marchand"]),
  ]);

  const condense = graph([
    node("F01", "le marchand quitte la ville et traverse le désert", ["marchand"]),
    node("F20", "le marchand affronte les brigands et perd sa caravane", ["marchand", "brigands"]),
    node("F40", "le marchand libère les captifs puis triomphe", ["marchand", "captifs"]),
  ]);

  it("explique intégralement le candidat condensé", () => {
    const resultat = align(source, condense);
    expect(resultat.containment).toBe(1);
    expect(resultat.candCovered).toBe(3);
  });

  it("identifie les fusions et leur sens", () => {
    const resultat = align(source, condense);
    expect(resultat.condensedSteps).toBeGreaterThan(0);
    expect(resultat.absorbedNodes).toBeGreaterThan(0);
    expect(resultat.condensationRatio).toBeGreaterThan(1);
    expect(resultat.direction).toBe("cand_condenses_ref");
  });

  it("couvre plus d'épisodes source qu'il n'y a d'épisodes candidats", () => {
    const resultat = align(source, condense);
    // La preuve de la condensation : 3 nœuds candidats expliquent plus de 3
    // nœuds de la source. Un couplage injectif en plafonnerait à 3.
    expect(resultat.refCovered).toBeGreaterThan(condense.nodes.length);
  });

  it("détecte l'amplification, opération symétrique", () => {
    const resultat = align(condense, source);
    expect(resultat.direction).toBe("ref_condenses_cand");
    expect(resultat.condensedSteps).toBeGreaterThan(0);
  });
});

describe("Garde-fous contre les fusions opportunistes", () => {
  it("refuse d'absorber un épisode qui ne laisse aucune trace", () => {
    const source = graph([
      node("F20", "le chevalier affronte le dragon", ["chevalier", "dragon"]),
      node("F50", "la bergère cueille des fleurs au bord du ruisseau", ["bergère"]),
    ]);
    const candidat = graph([node("F20", "le chevalier affronte le dragon", ["chevalier", "dragon"])]);

    const resultat = align(source, candidat);
    // Le second épisode n'a rien de commun avec le résumé : il ne doit pas être
    // absorbé au seul mérite du premier.
    expect(resultat.refCovered).toBe(1);
    expect(resultat.condensedSteps).toBe(0);
  });

  it("n'invente pas de correspondance entre récits étrangers", () => {
    const a = graph([
      node("F20", "le chevalier affronte le dragon des cavernes", ["chevalier"]),
      node("F41", "le chevalier délivre le village", ["chevalier"]),
    ]);
    const b = graph([
      node("F20", "l'ingénieur débogue un pilote réseau défectueux", ["ingénieur"]),
      node("F41", "le déploiement réussit enfin", ["ingénieur"]),
    ]);

    const resultat = align(a, b);
    expect(resultat.containment).toBeLessThan(0.5);
  });

  it("plafonne le facteur de fusion", () => {
    const source = graph(
      Array.from({ length: 10 }, () => node("F20", "le marchand affronte les brigands", ["marchand"])),
    );
    const candidat = graph([node("F20", "le marchand affronte les brigands", ["marchand"])]);

    const resultat = align(source, candidat);
    // Au-delà de `maxMerge` (4 par défaut), on cesse de parler de condensation.
    expect(resultat.refCovered).toBeLessThanOrEqual(4);
  });

  it("respecte un maxMerge explicite", () => {
    const source = graph([
      node("F01", "le marchand quitte la ville", ["marchand"]),
      node("F13", "le marchand traverse le désert", ["marchand"]),
      node("F20", "le marchand affronte les brigands", ["marchand"]),
    ]);
    const candidat = graph([
      node("F01", "le marchand quitte la ville traverse le désert et affronte les brigands", ["marchand"]),
    ]);

    const sansFusion = alignSequences(source, candidat, { ...options, maxMerge: 1 });
    expect(sansFusion.condensedSteps).toBe(0);
    expect(sansFusion.refCovered).toBe(1);

    const avecFusion = alignSequences(source, candidat, { ...options, maxMerge: 3 });
    expect(avecFusion.refCovered).toBe(3);
  });
});

describe("Cas dégénérés", () => {
  it("retourne un alignement vide sur un graphe sans nœud", () => {
    const vide = graph([]);
    const plein = graph([node("F20", "un combat", ["héros"])]);
    for (const r of [align(vide, plein), align(plein, vide), align(vide, vide)]) {
      expect(r.containment).toBe(0);
      expect(r.steps).toHaveLength(0);
      expect(r.condensationRatio).toBe(1);
    }
  });

  it("gère un graphe d'un seul nœud", () => {
    const un = graph([node("F20", "le héros affronte la bête", ["héros"])]);
    const resultat = align(un, graph([...un.nodes]));
    expect(resultat.containment).toBe(1);
  });
});

describe("Intégration au rapport de comparaison", () => {
  const source = graph([
    node("F01", "le marchand quitte la ville au matin", ["marchand"]),
    node("F13", "le marchand traverse le désert pendant des jours", ["marchand"]),
    node("F20", "le marchand affronte les brigands de la passe", ["marchand", "brigands"]),
    node("F24", "le marchand blessé perd sa caravane", ["marchand"]),
    node("F40", "le marchand libère les captifs de la citadelle", ["marchand", "captifs"]),
    node("F41", "le marchand triomphe et rentre chez lui", ["marchand"]),
  ]);
  const condense = graph([
    node("F01", "le marchand quitte la ville et traverse le désert", ["marchand"]),
    node("F20", "le marchand affronte les brigands et perd sa caravane", ["marchand", "brigands"]),
    node("F40", "le marchand libère les captifs puis triomphe", ["marchand", "captifs"]),
  ]);

  it("publie la mesure séquentielle et le facteur de condensation", () => {
    const resultat = compare(source, condense);
    expect(resultat.inclusion.sequential).toBeGreaterThan(0);
    expect(resultat.inclusion.condensedNodes).toBeGreaterThan(0);
    expect(resultat.inclusion.condensationRatio).toBeGreaterThan(1);
  });

  it("relève la couverture structurelle au-dessus du couplage injectif", () => {
    const resultat = compare(source, condense);
    expect(resultat.inclusion.structural).toBeGreaterThanOrEqual(resultat.inclusion.sequential);
    expect(resultat.inclusion.structural).toBe(1);
    expect(resultat.inclusion.detected).toBe(true);
  });

  it("ne signale aucune condensation entre deux œuvres étrangères", () => {
    const autre = graph([
      node("F10", "l'ingénieure rencontre son mentor au laboratoire", ["ingénieure"]),
      node("F31", "la révélation du sabotage industriel", ["ingénieure"]),
    ]);
    const resultat = compare(source, autre);
    expect(resultat.inclusion.condensedNodes).toBe(0);
    expect(resultat.inclusion.condensationRatio).toBe(1);
  });
});
