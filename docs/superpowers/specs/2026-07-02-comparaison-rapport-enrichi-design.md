# Comparaison enrichie — upload multi-format + extraction LLM + rapport fidèle (Phase 2)

Date : 2026-07-02
Statut : Approuvé (design hérité de la Phase 1, décisions identiques)

## Contexte

Suite de la Phase 1 (analyse enrichie, livrée et déployée). On applique le **même
traitement** à la fonctionnalité de **comparaison** (`/comparer`), sur le même principe :
port fidèle du rendu de l'ancien rapport Python de comparaison, thème sombre à l'écran /
palette d'origine claire à l'export, upload multi-format, extraction LLM des deux œuvres.

**Rendu de référence (à reproduire fidèlement)** : le fichier
`comparaison_c_20260529_192412_706239 (1).html` partagé par l'utilisateur, généré par
`narria/m5_reporting/reporter.py::generate_html` + `_render_llm_metadata`.

**Principe directeur, non négociable** : reproduire exactement la logique et le rendu
Python. Le moteur de calcul (`comparator.ts`) est **déjà porté fidèlement** (harnais de
non-régression vert vs Python). Cette phase ne touche PAS aux algorithmes de scoring —
seulement à l'extraction (heuristique → LLM), au rendu et à l'export.

## Décisions héritées de la Phase 1 (déjà approuvées, non re-débattues)

- **Mode LLM par défaut** : la comparaison analyse les deux œuvres via `analyzeLLM`
  (extraction narratologique Claude), comme l'analyse. C'est la seule façon de produire la
  section « Analyse sémantique (mode LLM) » du rapport de référence (résumé, genre,
  tradition, thématiques, schéma actantiel par œuvre).
- **Upload multi-format** : réutilisation intégrale de la Phase 1 (`file-extractor.ts`,
  route `/api/extract-file`, composant `FileDropzone`) — rien à réécrire.
- **Export HTML + PDF** : même mécanique que la Phase 1 (`pdf.ts` via
  puppeteer-core/@sparticuz/chromium déjà en place ; template HTML autoportant en palette
  claire d'origine).
- **Thème** : rapport recoloré au thème sombre de l'app à l'écran, palette claire d'origine
  à l'export téléchargé.

## Sources de vérité (fichiers Python à porter fidèlement)

- `narria/m5_reporting/reporter.py::generate_html` (lignes 22-253) — structure complète du
  rapport de comparaison HTML (œuvres comparées + sparklines de tension, scores composites
  SNS/SNS_N/SS/ST/SRJ avec badge SRJ coloré, verdict, détail des composantes, note
  méthodologique, correspondances structurales, limites/avertissements, footer).
- `narria/m5_reporting/reporter.py::_render_llm_metadata` (lignes 255-308) — bloc « Analyse
  sémantique (mode LLM) » : par œuvre, résumé/genre/tradition/thématiques/schéma
  actantiel/coût.
- `web/lib/engine/comparison/comparator.ts` — déjà porté ; produit `ComparisonResult`
  (`sns, snsNormalized, ss, st, srj, srjLevel, sIso, sGed, sFunc, sAct, sTens,
  detectedModality, verdict, correspondences, warnings`).

## Détail

### 1. Extraction LLM des deux œuvres + arêtes séquentielles

- `/api/compare` remplace `analyzeHeuristic` par `analyzeLLM` pour les deux textes (deux
  appels Claude). Coût cumulé journalisé via `recordUsage` (route « compare »).
- L'extracteur LLM (`llm-extractor.ts`) construit désormais des **arêtes séquentielles**
  (n nœuds → n-1 transitions de type « sequential ») au lieu de `edges: []`, pour que le
  rapport affiche un nombre de transitions cohérent (« N nœuds, M transitions » comme dans
  le rendu de référence). Sans effet sur `comparator.ts` (qui n'utilise pas les arêtes) ni
  sur le rapport d'analyse de la Phase 1.

### 2. Persistance (modèle Mongoose `Comparison`)

Champs ajoutés pour pouvoir régénérer le rapport complet à l'export (comme l'analyse
stocke son graphe) : `refGraph` (Mixed), `candGraph` (Mixed), `snsNormalized`, `costUsd`.
Le `mode` passe par défaut à `"llm"`. Les scores et le reste (`srjLevel`, `modality`,
`verdict`, `correspondences`, `warnings`) restent tels quels.

### 3. Upload sur `/comparer`

Un `FileDropzone` (composant Phase 1, inchangé) sous chaque colonne (référence +
candidate), pré-remplissant le texte + le titre de la colonne concernée. Warnings
d'extraction affichés.

### 4. Rendu du rapport de comparaison (`/comparer`)

Nouveau composant `ComparisonReport` (thème sombre), reproduisant toutes les sections de
`reporter.py::generate_html` :

1. **Œuvres comparées** : deux colonnes (réf/candidate), titre/auteur, `graphId` + N
   nœuds/M transitions, **sparkline de tension** (barres verticales, port de
   `tension_bars`).
2. **Analyse sémantique (mode LLM)** : par œuvre, résumé/genre/tradition/thématiques/schéma
   actantiel (6 rôles)/coût — port de `_render_llm_metadata`.
3. **Scores composites** : SNS (mis en avant), SNS_N, SS, ST, SRJ (avec badge coloré selon
   le niveau Faible/Modéré/Élevé/Critique).
4. **Verdict interprétatif** : modalité détectée + texte (fond « warning » si SNS > 0.5).
5. **Détail des composantes du SNS** : tableau S_ISO/S_GED/S_FUNC/S_ACT/S_TENS avec leurs
   descriptions exactes.
6. **Note méthodologique** : texte exact sur indicateurs primaires/secondaires.
7. **Correspondances structurales principales** : tableau top-15 (# / nœud réf (fonction) /
   nœud candidat (fonction) / similarité %).
8. **Limites et avertissements** : liste exacte des 5 points « À retenir impérativement ».
9. Footer.

### 5. Export HTML / PDF

- `web/lib/reports/comparison-html-report.ts` : port fidèle de `reporter.py::generate_html`
  + `_render_llm_metadata`, palette d'origine claire (Georgia serif, #1F4E79/#C55A11/#BDD7EE,
  badge SRJ coloré, sparklines).
- Route `GET /api/compare/[id]/export?format=html|pdf` (réutilise `htmlToPdf` de `pdf.ts`),
  même pattern que `/api/analyze/[id]/export` (auth, validation ObjectId, scoping ownerId,
  Content-Disposition attachment, try/catch PDF).
- Boutons « Télécharger HTML » / « Télécharger PDF » sur le `ComparisonReport`.

## Hors scope

- Modification des algorithmes de scoring de `comparator.ts` (déjà validés vs Python).
- Le logo base64 et l'attribution institutionnelle personnelle de l'auteur original (comme
  en Phase 1, non repris — éléments d'attribution personnelle, pas de logique métier). Le
  footer reste « NARR'IA · narria.tech · 2026 » comme dans `reporter.py`.

## Tests

- Extension du modèle : non testée unitairement (Mongoose).
- Arêtes séquentielles LLM : test unitaire (n nœuds → n-1 arêtes séquentielles).
- Rapport HTML de comparaison : test de fidélité structurelle (présence des sections, des
  couleurs d'origine, des scores, du badge SRJ, échappement XSS, robustesse aux champs
  manquants) — même approche que le test du rapport d'analyse.
- Non-régression : les 43 tests existants restent verts, `comparator.ts` inchangé.
