/**
 * Messages de progression affichés pendant une extraction narratologique via IA.
 * Le pourcentage seul ne suffit pas à donner une impression d'avancement — plusieurs
 * libellés se succèdent selon le palier atteint.
 */
export function describeExtractionProgress(percent: number, chunkIndex?: number, chunkTotal?: number): string {
  const chunkSuffix = chunkTotal && chunkTotal > 1 ? ` (bloc ${chunkIndex}/${chunkTotal})` : "";
  if (percent < 15) return `Lecture du texte…${chunkSuffix}`;
  if (percent < 40) return `Identification des fonctions narratives…${chunkSuffix}`;
  if (percent < 70) return `Analyse via IA en cours…${chunkSuffix}`;
  if (percent < 90) return `Construction du schéma actantiel…${chunkSuffix}`;
  return `Finalisation du graphe narratif…${chunkSuffix}`;
}
