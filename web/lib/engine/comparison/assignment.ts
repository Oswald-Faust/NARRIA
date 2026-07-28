/**
 * Appariement biparti optimal (algorithme hongrois, variante Kuhn–Munkres avec
 * potentiels, O(n²m)).
 *
 * Motivation — retour des bêta-testeurs : l'appariement de nœuds procédait par
 * choix glouton (les meilleures paires d'abord, chaque nœud ne servant qu'une
 * fois). Un glouton est injectif mais non optimal : sur deux graphes pourtant
 * jumeaux, il laissait des nœuds orphelins parce qu'un appariement localement
 * meilleur en consommait un dont un autre nœud avait besoin. Le hongrois
 * garantit que la somme des gains est maximale, donc qu'aucun nœud ne reste
 * orphelin s'il existe un appariement qui l'explique.
 *
 * Les graphes narratifs comptent quelques dizaines de nœuds : le coût cubique
 * est sans conséquence ici.
 */

/**
 * Résout l'affectation de gain MAXIMAL sur une matrice rectangulaire.
 *
 * @param gain `gain[i][j]` = bénéfice d'apparier la ligne i à la colonne j.
 *   Une paire interdite doit valoir 0 (ou négatif) : elle ne sera jamais
 *   retenue dans le résultat.
 * @returns `assignment[i]` = colonne affectée à la ligne i, ou −1 si la ligne
 *   reste non appariée (aucune affectation de gain strictement positif).
 */
export function maxWeightAssignment(gain: number[][]): number[] {
  const rows = gain.length;
  if (rows === 0) return [];
  const cols = gain[0].length;
  if (cols === 0) return new Array(rows).fill(-1);

  // L'implémentation exige n ≤ m : on travaille sur la transposée si besoin,
  // puis on rétablit l'orientation d'origine.
  const transposed = rows > cols;
  const n = transposed ? cols : rows;
  const m = transposed ? rows : cols;
  const at = (i: number, j: number) => (transposed ? gain[j][i] : gain[i][j]);

  // Le hongrois minimise : on passe en coût par négation du gain.
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0); // p[j] = ligne (1-indexée) affectée à la colonne j
  const way = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = -at(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const result = new Array(rows).fill(-1);
  for (let j = 1; j <= m; j++) {
    const i = p[j];
    if (i <= 0) continue;
    // Une affectation de gain nul correspond à une paire interdite : le
    // hongrois complète toujours l'appariement, à nous d'écarter ces paires.
    if (!(at(i - 1, j - 1) > 0)) continue;
    if (transposed) result[j - 1] = i - 1;
    else result[i - 1] = j - 1;
  }
  return result;
}
