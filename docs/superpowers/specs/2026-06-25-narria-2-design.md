# NARR'IA 2.0 — Spécification de conception

**Date :** 2026-06-25
**Auteur produit :** Faust Oswald (dev), d'après l'œuvre d'Adéchinan David Adékambi
**Statut :** Validé pour rédaction du plan d'implémentation
**Objet :** Réécriture complète du SaaS NARR'IA (Flask vibecodé → Next.js) avec design Figma.

---

## 1. Vision

NARR'IA est un **SaaS de narratologie computationnelle** qui détecte, quantifie et qualifie le **vol d'intrigue** — la reprise non déclarée de la *structure narrative profonde* d'une œuvre. Contrairement aux détecteurs de plagiat textuel (qui comparent des mots), NARR'IA compare des **structures** : séquences de fonctions narratives, configurations actantielles, trajectoires modales et signatures tensives.

La v2 transforme l'outil à onglets actuel en un **produit conversationnel** : NARR'IA devient « votre expert conversationnel en narratologie et littérature ». Le **Chat agent** est l'épicentre — l'utilisateur dialogue en langage naturel, et l'IA orchestre l'analyse, la comparaison et la consultation du répertoire via des outils (tool-calling).

### Objectifs
- Reprendre **100 %** des capacités métier de la v1 (moteur d'analyse + comparaison + reporting).
- Réécrire intégralement en **TypeScript** (front + back unifiés dans Next.js).
- Implémenter le **design Figma** (charte Quicksand/Kantumruy, palette purple/pink) au pixel.
- Architecture **propre, modulaire, typée, testée** — l'opposé du monolithe `app.py` (2609 lignes) actuel.

### Non-objectifs (v2)
- Pas d'app mobile native (web responsive uniquement).
- Pas d'OCR de PDF scannés (comme la v1 : on prévient, on ne traite pas).
- Pas de collaboration multi-utilisateurs temps réel sur un même projet (mono-propriétaire).

---

## 2. Décisions structurantes (validées)

| Sujet | Décision | Conséquence |
|---|---|---|
| Moteur narratologique | **Réécriture en TypeScript** | Stack unifiée ; **harnais de non-régression** obligatoire vs sortie Python |
| Chat | **Agent conversationnel à outils** | Vercel AI SDK + Claude, tool-calling, streaming |
| Séquencement | **MVP vertical d'abord** | Slice 1 livrable de bout en bout, puis extensions |
| Base de données | **MongoDB** (Mongoose) | Remplace SQLite + fichiers JSON ; URI en `.env.local` |
| Authentification | **Auth.js (NextAuth)** | OTP + 2FA implémentés nous-mêmes |
| Hébergement | **Vercel** | App Router, previews par PR |
| LLM | **Claude (Anthropic)** | `claude-sonnet-4-6` par défaut (analyse), via AI SDK |

> ⚠️ **Sécurité MongoDB** : l'URI fournie (`mongodb+srv://faust:faust@...`) utilise des identifiants faibles et partagés. Acceptable en dev ; **à rotater + restreindre par IP allowlist avant toute mise en production**. Jamais committée — uniquement dans `.env.local` (gitignored) et les variables d'environnement Vercel.

---

## 3. Design system

Mappé 1:1 sur la page « UI System » du Figma.

### Couleurs (tokens)
| Token | Hex | Usage |
|---|---|---|
| `--dark-purple` | `#0F3039` | Texte titres, fonds sombres profonds |
| `--purple` | `#843B90` | Primaire, sidebar, dégradés |
| `--pink` | `#DA3861` | CTA principal (boutons d'action) |
| `--yellow` | `#F4AD5C` | Accents, alertes douces |
| `--soft-purple` | `#C68CC4` | Tuiles d'icônes, états secondaires |
| `--soft-pink` | `#FC92A4` | Hover CTA, badges |
| `--dark-grey` | `#6C6C6C` | Texte secondaire |
| `--grey` | `#BFBFBF` | Bordures, désactivé |
| `--light-grey` | `#F9F9F9` | Fonds clairs |
| `--white` | `#FFFFFF` | Surfaces |

### Typographie
- **Quicksand** (Bold) — titres : 34 / 30 / 28 / 14 / 8 pt.
- **Kantumruy Pro** (Regular + Bold) — corps : 24 / 20 / 18 / 14 / 12 / 10 / 8 pt.
- Chargées via `next/font` (Google Fonts).

### Composants
- 7 variantes de boutons « pill » (primaire rose, secondaire gris, avec/sans icône, désactivé).
- Cards arrondies (radius 16), headers de section en **dégradé violet**.
- Badges colorés (familles de fonctions, niveaux SRJ, scores SNS).
- Set d'icônes complet (récupéré depuis Figma en SVG via `download_assets`).
- Thème **Dark dominant** (app + auth) avec variantes Light (slice 3).

### Implémentation
- **Tailwind CSS** + **shadcn/ui** comme base, **restylés** sur les tokens ci-dessus (ne pas livrer du shadcn par défaut).
- Tokens centralisés dans `tailwind.config.ts` + CSS variables dans `app/globals.css`.
- Composants dans `components/ui/` mappés sur le UI System (Button, Card, Badge, Input, Sidebar, Topbar, GradientHeader…).

---

## 4. Architecture technique

Application **Next.js 15 unique** (App Router, TypeScript strict), pas de microservice.

```
narria-app/
├─ app/
│  ├─ (auth)/                  # login, register, otp, reset, mot de passe oublié
│  ├─ (app)/                   # shell authentifié (sidebar + topbar)
│  │  ├─ accueil/
│  │  ├─ chat/                 # NARR'IA Chat (épicentre)
│  │  ├─ analyser/
│  │  ├─ comparer/
│  │  ├─ repertoire/
│  │  ├─ historique/
│  │  ├─ dashboard/            # slice 2
│  │  ├─ projets/              # slice 2
│  │  ├─ notifications/        # slice 2
│  │  ├─ profil/               # + securite, 2fa
│  │  └─ aide/                 # slice 3
│  └─ api/                     # route handlers REST
│     ├─ auth/                 # Auth.js + otp + 2fa
│     ├─ analyze/
│     ├─ compare/
│     ├─ chat/                 # endpoint streaming de l'agent
│     ├─ repertoire/
│     ├─ history/
│     └─ upload/
├─ lib/
│  ├─ engine/                  # MOTEUR porté en TS (cœur métier)
│  │  ├─ models.ts             # NarrativeNode, Edge, Graph, ComparisonResult
│  │  ├─ segmentation/         # M1
│  │  ├─ extraction/           # M2 : heuristique + LLM
│  │  ├─ comparison/           # M3 : SNS, SS, ST, SRJ
│  │  ├─ reporting/            # M5 : HTML/MD/PDF
│  │  └─ repertoire.ts         # 53 fonctions / 7 familles
│  ├─ ai/                      # agent + tools (analyzeText, compareTexts, lookupRepertoire)
│  ├─ db/                      # connexion Mongoose + modèles
│  ├─ auth/                    # config Auth.js, OTP, TOTP 2FA
│  ├─ io/                      # extraction de fichiers (txt/docx/pdf/odt/epub)
│  └─ quotas/                  # quotas + usage + coûts
├─ content/                    # samples (romeo_juliette, amants_conakry, saison_pluies)
├─ components/
│  ├─ ui/                      # design system
│  └─ features/                # composants métier par écran
├─ tests/
│  ├─ engine/                  # non-régression vs Python (fixtures)
│  └─ ...
└─ docs/
```

### Principes
- Chaque module du moteur = unité isolée, interface claire, testable seule.
- Aucune logique métier dans les composants React — tout passe par `lib/`.
- API route handlers minces : valident (zod), appellent `lib/`, renvoient du JSON typé.

---

## 5. Le moteur narratologique (port TypeScript)

Le cœur scientifique. Port fidèle des modules Python `m1`→`m5`.

### Modèles (`lib/engine/models.ts`)
- `NarrativeNode` : `function_code`, `function_family`, `function_name`, `actants[]`, `modalities{vouloir,pouvoir,devoir,savoir}`, `tension[0..1]`, `phase`, `text_excerpt`.
- `NarrativeEdge` : `source`, `target`, `transition_type`, `weight`.
- `NarrativeGraph` (le **NarRep-Graph**, l'« ADN d'intrigue ») : `nodes[]`, `edges[]`, + dérivés `functionSequence()`, `actantialChain()`, `tensionProfile()`.
- `ComparisonResult` : `sns`, `ss`, `st`, `srj`, `srjLevel`, composantes `sIso/sGed/sFunc/sAct/sTens`, `detectedModality`, `verdict`, `correspondences[]`, `warnings[]`.

### Pipeline
1. **M1 Segmentation** — découpe le texte en segments narratifs.
2. **M2 Extraction** — deux moteurs interchangeables :
   - **Heuristique locale** (mots-clés, gratuit, hors-ligne).
   - **LLM (Claude)** — identification fine des fonctions/actants/modalités avec justifications.
3. **M3 Comparaison** — produit le **SNS composite** :
   ```
   SNS = 0.25·S_iso + 0.20·S_ged + 0.25·S_func + 0.15·S_act + 0.15·S_tens
   ```
   - `S_iso` : isomorphisme de graphes pondéré (seuil d'appariement `MATCH_THRESHOLD = 0.40`).
   - `S_ged` : distance d'édition de graphes narrative.
   - `S_func` : alignement de la séquence de fonctions.
   - `S_act` : chaîne actantielle + persistance + alignement greimassien.
   - `S_tens` : corrélation des profils tensifs (rééchantillonnés).
   - Puis **SS** (spécificité), **ST** (transformation), **SRJ** (risque juridique : Faible/Modéré/Élevé/Critique), classification de **modalité** (Transposition / Amplification / Condensation / Inversion / Hybridation / Aucune), `verdict` textuel.
4. **M5 Reporting** — rendu HTML / Markdown / PDF (incluant le graphe actantiel en SVG).

### Répertoire
53 fonctions narratives en 7 familles (extension des 31 fonctions proppiennes + 7 fonctions propres aux traditions africaines). Données statiques dans `lib/engine/repertoire.ts`.

### Harnais de non-régression (bloquant)
Test automatisé : les 3 samples (`romeo_juliette`, `amants_conakry`, `saison_pluies`) sont analysés et comparés par paires, en mode heuristique, par **l'ancien Python ET le nouveau TS**. Les scores SNS/SS/ST/SRJ et les séquences de fonctions doivent **coïncider à ε près** (tolérance numérique documentée). Un module n'est considéré porté que lorsque son fixture passe. Les sorties Python de référence sont gelées dans `tests/engine/fixtures/`.

---

## 6. L'agent Chat (épicentre)

Conversation streamée propulsée par le **Vercel AI SDK** + **Claude**.

### Comportement
- L'utilisateur écrit en langage naturel. L'agent dispose de **3 outils** :
  - `analyzeText({ text, title?, author? })` → lance le pipeline M1→M2→M3-graph, renvoie le NarRep-Graph + résumé.
  - `compareTexts({ refId|refText, candId|candText })` → renvoie `ComparisonResult` (SNS/SS/ST/SRJ + verdict).
  - `lookupRepertoire({ query|family|code })` → renvoie les fonctions du répertoire.
- Réponses **structurées** : l'agent rend des cards (dépôt légal, score SNS, verdict…) + boutons d'action (Analyser / Comparer / Exporter) comme dans la maquette.
- **Citations** : les extraits textuels qui justifient une fonction/un score sont cités.
- **Mémoire** : chaque session de chat est liée à un **projet** (slice 2) ou autonome ; l'historique des messages + tool calls est persisté.
- **Streaming** : réponses token par token (UX de la maquette « Protection Plagiat »).
- **Filtre Chat** : filtrage/recherche dans les sessions.

### Garde-fous
- Restriction culturelle héritée de la v1 (`_enforce_cultural_restriction`) conservée côté extraction LLM.
- Décompte de tokens + coûts par message, imputé aux quotas utilisateur.

---

## 7. Données (MongoDB / Mongoose)

| Collection | Champs clés |
|---|---|
| `users` | email, passwordHash, nomComplet, prenom, langue, role (`user`/`admin`), quotaDaily, quotaMonthly, isActive, twoFactor{enabled, secret, backupCodes[]}, recoveryEmail, plan (`free`/`pro`), createdAt |
| `analyses` | ownerId, title, author, mode (`heuristic`/`llm`), graph (NarRep-Graph), wordCount, costTokens, createdAt |
| `comparisons` | ownerId, refId, candId, scores{sns,ss,st,srj}, srjLevel, modality, verdict, correspondences[], createdAt |
| `chatSessions` | ownerId, projectId?, title, messages[{role, content, toolCalls?}], createdAt, updatedAt |
| `projects` | ownerId, name, description, workIds[], createdAt *(slice 2)* |
| `notifications` | ownerId, type, payload, read, createdAt *(slice 2)* |
| `usageLog` | ownerId, action, costTokens, costEuros, createdAt |

- Connexion Mongoose singleton (cache global pour serverless Vercel).
- Index : `users.email` (unique), `analyses.ownerId`, `comparisons.ownerId`, `chatSessions.ownerId`.

---

## 8. Authentification & sécurité

- **Auth.js (NextAuth)** avec adaptateur MongoDB + provider Credentials (email/mot de passe) ; social Google/Apple prévu dans l'UI (activable plus tard).
- **Inscription** : Nom complet, Prénom, email, mot de passe + confirmation, CGU.
- **OTP** : code à 5 chiffres envoyé par email à l'inscription, avec expiration + renvoi (écran « Vérification »).
- **2FA** : TOTP (application authenticator, ex. `otpauth`) + option SMS + **codes de secours** téléchargeables (écran « Double authentification »).
- **Récupération** : mot de passe oublié (lien email), modification mot de passe, modification email de récupération.
- **Hashing** : bcrypt/argon2 (remplace le hashing maison v1).
- **Headers de sécurité** repris de la v1 (nosniff, frame-options, referrer-policy, HSTS en prod).
- **Rate limiting** sur les routes d'auth (équivalent Flask-Limiter).
- **Quotas** : journaliers + mensuels par utilisateur, imputation des coûts LLM, page admin.

---

## 9. I/O fichiers

Reprise de la capacité v1 : extraction de texte depuis **`.txt`, `.docx`, `.pdf` (couche texte), `.odt`, `.epub`**, jusqu'à 300 Mo, drag & drop. Pré-remplissage titre/auteur depuis les métadonnées. Détection des PDF scannés (avertissement, pas d'OCR). Suppression heuristique des headers/footers récurrents. Librairies Node équivalentes : `mammoth` (docx), `pdf-parse`/`unpdf` (pdf), `epub2`, parseur ODT.

---

## 10. Périmètre par slice

### Slice 1 — MVP vertical (objet du plan d'implémentation)
1. Setup projet (Next.js 15, TS strict, Tailwind, shadcn restylé, fonts, lint).
2. **Design system** : tokens, composants `ui/`, shell (sidebar dégradé + topbar), icônes Figma.
3. **Auth complète** : Login, Sign Up, OTP, mot de passe oublié/reset, 2FA, sessions.
4. **Moteur porté & validé** : models, M1, M2 (heuristique + LLM), M3, répertoire + **harnais de non-régression vert**.
5. **Accueil** (hero + 3 cards).
6. **Analyser un texte** (formulaire + upload + résultat).
7. **Comparer deux textes** (2 colonnes + résultat scores).
8. **Répertoire** (stats + familles + table).
9. **NARR'IA Chat** (agent + 3 tools + streaming + réponses structurées).
10. **Historique** de base (analyses/comparaisons/chat).
11. Déploiement Vercel + variables d'environnement.

### Slice 2
Dashboard analytics (KPIs + courbes + donut + bar par genre), Projets (liste, nouveau, espace de travail avec chat contextualisé), Notifications.

### Slice 3
Aide, abonnement & facturation PRO, thème Light, filtres avancés (Filtre Comparaison / Filtre Chat), export PDF stylé, admin avancé.

---

## 11. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Régression de scoring au port TS | Harnais de non-régression bloquant sur les 3 samples (ε documenté) |
| Identifiants MongoDB faibles | `.env.local` + rotation + IP allowlist avant prod |
| Coûts LLM non maîtrisés | Quotas + décompte de tokens + estimation de coût avant analyse (repris v1) |
| Scope global important | Découpage strict en slices ; Slice 1 seul est planifié maintenant |
| Fidélité au design Figma | `get_design_context` par écran au moment de coder + revue visuelle |
| Limite Figma MCP (plan Starter) | Extraction des specs écran par écran à l'implémentation, pas en masse |

---

## 12. Critères de succès du Slice 1
- Un utilisateur peut s'inscrire (OTP), activer la 2FA, se connecter.
- Il peut analyser un texte, comparer deux textes, obtenir des scores SNS/SS/ST/SRJ cohérents avec la v1.
- Il peut dialoguer avec NARR'IA Chat qui déclenche réellement analyse/comparaison/répertoire.
- L'interface respecte la charte Figma (Quicksand/Kantumruy, palette, composants).
- Le harnais de non-régression du moteur est vert.
- L'app est déployée sur Vercel.
