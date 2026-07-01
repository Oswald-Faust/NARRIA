# Analyse de texte enrichie — upload multi-format + extraction LLM + rapport fidèle (Phase 1)

Date : 2026-07-01
Statut : Approuvé

## Contexte

L'ancienne app NARR'IA (Python/Flask, dossier `narria/`) produisait, pour une analyse de
texte, un rapport riche : synthèse LLM (résumé, genre, tradition narrative, thématiques),
schéma actantiel de Greimas (tableau + SVG géométrique), et un graphe narratif détaillé
(nœuds avec code de fonction, actants, modalités greimassiennes, tension, phase, citation
du texte). Voir exemples de référence :
`~/Downloads/Roméo_et_Juliette_synopsis_romancé_a_20260630_164315_509162.html` et `.pdf`.

La nouvelle app Next.js (`web/`) a un moteur TS (`web/lib/engine/`) qui ne fait que de
l'extraction **heuristique** (pas de LLM), et une page `/analyser` qui n'affiche qu'une
liste plate de nœuds (code, actants, phase, tension) — sans synthèse, sans schéma
actantiel, sans citations, sans upload de fichier.

**Principe directeur, non négociable** : on reproduit **exactement** la logique métier
Python existante (prompts, calculs, structure de données, règles de nettoyage de texte,
géométrie du SVG actantiel). Aucune réinvention, aucune simplification du comportement.
Seul le rendu visuel (thème sombre violet/rose de NARR'IA 2.0 au lieu de la palette claire
d'origine) change dans l'affichage in-app — l'export HTML/PDF, lui, reproduit la palette
d'origine à l'identique.

Phase 2 (hors scope de ce document) : même traitement pour `/comparer` (upload + rendu
fidèle du rapport de comparaison). Le moteur de comparaison (`comparator.ts`) est déjà
porté ; il restera à porter le rendu et réutiliser l'upload construit ici.

## Sources de vérité (fichiers Python à porter fidèlement)

- `narria/io/file_extractor.py` — extraction texte depuis txt/docx/pdf/odt/epub + nettoyage.
- `narria/llm/claude_client.py` — system prompt narratologique, user prompt, schéma JSON
  attendu, restriction culturelle FN\*, parsing.
- `narria/llm/chunker.py` — découpage des textes longs + fusion de graphes partiels.
- `narria/core/models.py` — structures `NarrativeNode` / `NarrativeGraph`.
- `narria/app.py::_render_analysis_html` (lignes ~2191-2317) — structure et contenu du
  rapport HTML.
- `narria/app.py::_render_actantial_svg` (lignes ~2394-2470) — géométrie exacte du SVG
  actantiel (axes, cartouches, positions).

## 1. Upload & extraction multi-format

**Formats supportés** : `.txt`, `.docx`, `.pdf`, `.odt`, `.epub` — identiques à
`FileExtractor.SUPPORTED_FORMATS` en Python. Pas d'OCR (même limite que l'ancien système).

**Nouveau module** `web/lib/engine/extraction/file-extractor.ts` :
- Un extracteur par format, port direct de chaque `_extract_*` Python :
  - `.txt` : lecture UTF-8 avec fallback Latin-1.
  - `.docx` : `mammoth` — paragraphes + tables, métadonnées (title/author) si présentes.
  - `.pdf` : `unpdf` (pas de dépendance native, compatible runtime serverless Vercel) —
    texte par page, métadonnées, détection heuristique "PDF scanné" identique
    (`n_pages >= 3 && text.length < n_pages * 50` → warning).
  - `.odt` : `jszip` pour lire `content.xml`, extraction des paragraphes `<text:p>`.
  - `.epub` : `jszip` + parsing du spine (`content.opf`) dans l'ordre de lecture, chaque
    chapitre parsé avec un parseur HTML léger (`cheerio`) — même logique de suppression
    des `<script>/<style>/<nav>/<header>/<footer>`, `<br>` → `\n`, extraction par
    éléments de bloc (p, div, h1-h6, li, blockquote, pre), avec fallback texte brut.
- **Nettoyage de texte** (`cleanText()`) : port exact de `_clean_text` +
  `_remove_recurring_lines` (lignes répétées ≥3 fois, <80 caractères, ne commençant pas
  par une minuscule → probable header/footer) + `_remove_page_numbers` (lignes numéro de
  page isolé). Appliqué uniquement pour les PDF, comme en Python.
- Retourne une structure `ExtractionResult` : `{ text, sourceFormat, sourceFilename,
  wordCount, charCount, pageCount?, paragraphCount?, warnings[], title, author }` —
  même forme que le dataclass Python.

**Route** `POST /api/extract-file` (multipart/form-data, champ `file`) :
- Valide l'extension, taille max 25 Mo.
- Appelle l'extracteur correspondant, retourne `{ text, title, author, sourceFormat,
  wordCount, warnings }` en JSON, ou 422 avec message clair si échec (format non supporté,
  fichier corrompu, PDF chiffré non déchiffrable, EPUB sans texte extractible).

**UI** : composant `FileDropzone` ajouté sur `/analyser`, au-dessus ou à côté du textarea
existant. Après upload réussi : pré-remplit `text`, `title`, `author` (l'utilisateur reste
libre de modifier avant de lancer l'analyse) et affiche les warnings s'il y en a.

## 2. Extraction LLM en TypeScript

**Nouveau module** `web/lib/engine/extraction/llm-extractor.ts`, qui devient le **mode
unique** de `/api/analyze` (remplace l'appel actuel à `analyzeHeuristic` en usage
principal ; le code heuristique existant reste disponible en interne pour
segmentation/fallback mais n'est plus le chemin utilisateur par défaut).

- **System prompt** : port texte-à-texte du `SYSTEM_PROMPT_NARRATOLOGY` de
  `claude_client.py` — répertoire des 53 fonctions, règle de granularité (~1 nœud /
  400 mots de texte, plancher 5, plafond 35 nœuds), restriction culturelle stricte sur les
  fonctions `FN*` (réservées aux traditions africaines/afro-caribéennes, avec mapping de
  repli vers l'équivalent occidental sinon), double configuration actantielle
  (`main_actants_v1` = agent actif, `main_actants_v2` = patient central).
- **User prompt** : même template (métadonnées, texte entre balises, instructions par
  nœud : code, actants avec rôles, modalités [0,1], tension, phase, citation textuelle,
  index de séquence).
- **Appel LLM** : `generateObject` du SDK `ai` (déjà utilisé pour le chat NARR'IA) avec un
  schéma Zod reproduisant exactement le JSON attendu (summary, genre, tradition,
  formal_features, nodes[], main_actants_v1, main_actants_v2, thematic_keywords). Le
  schéma Zod remplace le parsing manuel de fences markdown de la version Python (plus
  robuste), sans changer la donnée produite.
- **Chunking** : port de `chunker.py` — si le texte dépasse le seuil de tokens défini en
  Python, découpage avec recouvrement, analyse de chaque bloc, fusion via l'équivalent TS
  de `merge_partial_graphs` (préservation de cohérence aux frontières).
- **Coût** : calcul `costUsd` / `tokensTotal` à partir de l'`usage` retourné par le SDK et
  du tarif du modèle utilisé (consulter la skill `claude-api` pour le tarif exact au moment
  de l'implémentation).
- **Erreurs** : non-conformité JSON → retry automatique (géré nativement par `ai` avec
  schéma Zod) ; échec persistant → erreur utilisateur claire, pas de fallback silencieux
  vers un résultat vide.

**Modèle Mongoose `Analysis`** (`web/lib/db/models/analysis.ts`) — champs ajoutés :
`mode` ('llm'), `summary`, `genre`, `tradition`, `mainActants` (`{ v1: {...}, v2: {...} }`),
`thematicKeywords: string[]`, `formalFeatures` (objet tel que retourné par le LLM),
`costUsd`, `tokensTotal`, `sourceFile?: { filename, format, warnings }`.

## 3. Rendu du rapport (page `/analyser`)

Nouveau composant `AnalysisReport` (remplace/étend l'affichage actuel des résultats),
thème sombre violet/rose de l'app, mêmes sections et même contenu que
`_render_analysis_html` :

1. **En-tête méta** : œuvre, auteur, date d'analyse, mode.
2. **Synthèse** : résumé, genre, tradition narrative, thématiques (badges).
3. **Schéma actantiel** :
   - Tableau des 6 rôles (Sujet/protagoniste, Objet, Destinateur, Destinataire, Adjuvant,
     Opposant) avec les libellés exacts de `_render_analysis_html`.
   - SVG généré côté client (composant `ActantialDiagram`), port direct de la géométrie
     de `_render_actantial_svg` : mêmes proportions (`W=720, H=360, boxW=140, boxH=50`),
     mêmes positions (Destinateur/Objet/Destinataire en haut, Adjuvant/Sujet/Opposant en
     bas), mêmes axes (désir vertical, communication horizontale pointillée en haut,
     flèches pleine/pointillée en bas), troncature des libellés à 22 caractères — recoloré
     avec les tokens de couleur du thème sombre de l'app au lieu de la palette d'origine.
4. **Graphe narratif (N nœuds)** : une carte par nœud, reprenant tous les champs affichés
   en Python et absents de l'UI actuelle : code fonction + nom, famille, actants,
   modalités (vouloir/devoir/pouvoir/savoir avec valeurs), tension + phase, citation du
   texte (blockquote), dans cet ordre.
5. **Ligne de coût** : "Analyse via Claude — coût : X USD · Y tokens", affichée seulement
   en mode LLM avec coût disponible (identique à la condition Python).

## 4. Export HTML / PDF

- `GET /api/analyze/[id]/export?format=html` : régénère le HTML autoportant en réutilisant
  le **template Python original** (`_render_analysis_html` + `_render_actantial_svg`)
  porté à l'identique en TS (même CSS inline, même palette claire #1F4E79/#C55A11, même
  police Georgia, même structure), servi en téléchargement (`Content-Disposition:
  attachment`).
- `GET /api/analyze/[id]/export?format=pdf` : même HTML rendu en PDF via `puppeteer-core`
  + `@sparticuz/chromium` (pattern standard pour génération PDF sur runtime serverless
  Vercel), téléchargé en `.pdf`.
- Deux boutons "Télécharger HTML" / "Télécharger PDF" sur la page de résultat
  d'`AnalysisReport`.

## Hors scope de ce document (Phase 2)

- Upload + rendu fidèle du rapport de **comparaison** (`/comparer`) : scores composites,
  verdict interprétatif, tableau de correspondances, sparklines de tension — même
  principe (palette d'origine à l'export, thème app à l'écran), sur la base du moteur
  `comparator.ts` déjà porté.
- OCR pour PDF scannés (non supporté en Python, donc non supporté ici).

## Tests

- Extraction fichier : un test par format (txt/docx/pdf/odt/epub) avec un fichier
  d'exemple, vérifiant texte + métadonnées + warnings attendus (notamment détection PDF
  scanné, EPUB sans texte).
- Nettoyage de texte : cas header/footer répété, numéros de page isolés — vérifier parité
  avec le comportement Python sur les mêmes entrées.
- Extraction LLM : test du schéma Zod (JSON valide accepté, JSON non conforme rejeté →
  retry), test de la restriction culturelle FN\* (texte non africain ne doit produire
  aucun code FN\*), test du chunking (texte long → fusion correcte du nombre de nœuds).
- Rapport : snapshot du SVG actantiel (positions/dimensions) pour non-régression
  géométrique ; test de l'export HTML (contient bien toutes les sections) et PDF (fichier
  non vide, bon content-type).
