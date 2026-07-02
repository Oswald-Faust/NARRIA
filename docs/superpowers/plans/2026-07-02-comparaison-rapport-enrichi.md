# Comparaison enrichie — Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Appliquer à `/comparer` le même traitement que la Phase 1 sur `/analyser` :
extraction LLM des deux œuvres, upload multi-format, et rapport de comparaison fidèle au
rendu Python (`narria/m5_reporting/reporter.py`) — à l'écran (thème sombre) et à l'export
HTML/PDF (palette d'origine claire).

**Architecture :** réutilise intégralement les briques Phase 1 (`file-extractor.ts`,
`/api/extract-file`, `FileDropzone`, `analyzeLLM`, `pdf.ts`, `htmlToPdf`). Le moteur de
scoring (`comparator.ts`) n'est PAS modifié. Le rendu du rapport suit le même découpage que
l'analyse : template HTML pur (`comparison-html-report.ts`) partagé par l'export, composant
React (`comparison-report.tsx`) pour l'écran.

**Spec :** `docs/superpowers/specs/2026-07-02-comparaison-rapport-enrichi-design.md`.
Référence Python : `narria/m5_reporting/reporter.py` (generate_html + _render_llm_metadata).

## File Structure

- Modifier `web/lib/engine/extraction/llm-extractor.ts` — arêtes séquentielles (n-1).
- Modifier `web/lib/db/models/comparison.ts` — refGraph/candGraph/snsNormalized/costUsd, mode llm.
- Modifier `web/app/api/compare/route.ts` — analyzeLLM ×2, persistance enrichie, recordUsage.
- Créer `web/components/comparer/tension-sparkline.tsx` — barres de tension.
- Créer `web/components/comparer/comparison-report.tsx` — rapport écran (thème sombre).
- Modifier `web/app/(app)/comparer/page.tsx` — FileDropzone ×2 + ComparisonReport + boutons export.
- Créer `web/lib/reports/comparison-html-report.ts` — template HTML palette d'origine.
- Créer `web/app/api/compare/[id]/export/route.ts` — export html + pdf.
- Créer `web/tests/engine/llm-extractor-edges.test.ts` et `web/tests/reports/comparison-html-report.test.ts`.

## Tasks

### Task C1 : arêtes séquentielles LLM + modèle Comparison + route /api/compare en mode LLM
Extracteur LLM construit n-1 arêtes séquentielles ; modèle Mongoose étendu ; route appelle
`analyzeLLM` ×2, stocke les deux graphes + scores enrichis, journalise le coût.

### Task C2 : upload FileDropzone ×2 sur /comparer
Une zone de dépôt par colonne (réf/candidate), réutilise `/api/extract-file`.

### Task C3 : ComparisonReport + tension-sparkline + intégration écran
Composant rapport complet (toutes les sections du reporter.py) au thème sombre, sparklines
de tension, intégré dans `/comparer` à la place de l'affichage inline actuel.

### Task C4 : export HTML/PDF fidèle + boutons
Template HTML palette d'origine (port de generate_html + _render_llm_metadata), route
d'export html+pdf, boutons de téléchargement sur le rapport.

Chaque tâche : implémentation TDD + revue conformité + revue qualité (subagents).
