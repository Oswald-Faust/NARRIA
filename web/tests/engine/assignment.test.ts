import { describe, it, expect } from "vitest";
import { maxWeightAssignment } from "@/lib/engine/comparison/assignment";

/** Gain total d'une affectation, pour comparer l'optimal au glouton. */
function totalGain(gain: number[][], assignment: number[]): number {
  return assignment.reduce((s, j, i) => (j >= 0 ? s + gain[i][j] : s), 0);
}

/** Appariement glouton — l'ancienne stratégie, conservée comme point de comparaison. */
function greedyAssignment(gain: number[][]): number[] {
  const pairs: [number, number, number][] = [];
  gain.forEach((row, i) => row.forEach((g, j) => g > 0 && pairs.push([g, i, j])));
  pairs.sort((a, b) => b[0] - a[0]);
  const usedRow = new Set<number>();
  const usedCol = new Set<number>();
  const out = new Array(gain.length).fill(-1);
  for (const [, i, j] of pairs) {
    if (usedRow.has(i) || usedCol.has(j)) continue;
    usedRow.add(i);
    usedCol.add(j);
    out[i] = j;
  }
  return out;
}

describe("maxWeightAssignment — appariement biparti optimal", () => {
  it("apparie chaque ligne à sa colonne sur une matrice identité", () => {
    const gain = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    expect(maxWeightAssignment(gain)).toEqual([0, 1, 2]);
  });

  it("n'apparie jamais une paire interdite (gain nul)", () => {
    const gain = [
      [0, 0],
      [0, 5],
    ];
    const a = maxWeightAssignment(gain);
    expect(a[0]).toBe(-1);
    expect(a[1]).toBe(1);
  });

  it("bat le glouton là où un choix local prive une autre ligne de son seul match", () => {
    // La ligne 0 peut prendre la colonne 0 (9) ou 1 (8) ; la ligne 1 ne peut
    // prendre que la colonne 0. Le glouton saisit 9 et laisse la ligne 1
    // orpheline (total 9) ; l'optimum apparie les deux (8 + 7 = 15).
    const gain = [
      [9, 8],
      [7, 0],
    ];
    const optimal = maxWeightAssignment(gain);
    expect(totalGain(gain, optimal)).toBe(15);
    expect(optimal.filter((j) => j >= 0)).toHaveLength(2);
    expect(totalGain(gain, greedyAssignment(gain))).toBe(9);
  });

  it("gère les matrices rectangulaires dans les deux orientations", () => {
    const wide = [
      [5, 1, 1],
      [1, 5, 1],
    ];
    expect(maxWeightAssignment(wide)).toEqual([0, 1]);

    const tall = [
      [5, 1],
      [1, 5],
      [1, 1],
    ];
    const a = maxWeightAssignment(tall);
    expect(a[0]).toBe(0);
    expect(a[1]).toBe(1);
    expect(a[2]).toBe(-1); // plus de lignes que de colonnes : une reste orpheline
  });

  it("n'est jamais moins bon que le glouton sur des matrices aléatoires", () => {
    // Générateur déterministe : le test doit être reproductible.
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let trial = 0; trial < 60; trial++) {
      const rows = 1 + Math.floor(rand() * 8);
      const cols = 1 + Math.floor(rand() * 8);
      const gain = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (rand() < 0.3 ? 0 : Math.round(rand() * 100) / 10)),
      );
      const optimal = totalGain(gain, maxWeightAssignment(gain));
      const greedy = totalGain(gain, greedyAssignment(gain));
      expect(optimal).toBeGreaterThanOrEqual(greedy - 1e-9);
    }
  });

  it("accepte les matrices vides", () => {
    expect(maxWeightAssignment([])).toEqual([]);
    expect(maxWeightAssignment([[]])).toEqual([-1]);
  });
});
