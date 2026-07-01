# NARR'IA 2.0 — Slice 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le MVP vertical de NARR'IA 2.0 : design system Figma, auth complète, moteur narratologique porté en TS et validé, écrans Analyser/Comparer/Répertoire, NARR'IA Chat (agent à outils) et historique de base, déployé sur Vercel.

**Architecture:** App Next.js 15 unique (App Router, TS strict) dans `web/`. Logique métier isolée dans `web/lib/` (engine, ai, db, auth, io, quotas). MongoDB via Mongoose. Auth.js. Vercel AI SDK + Claude. Le Python `narria/` du repo reste comme référence de non-régression.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui (restylé), Mongoose/MongoDB, Auth.js (NextAuth), Vercel AI SDK + @ai-sdk/anthropic, zod, Vitest.

---

## Découpage en phases

- **Phase 1 — Fondations** : scaffold, design system (tokens, fonts, composants UI), shell applicatif (sidebar + topbar). ← *détaillée ci-dessous, en cours*
- **Phase 2 — Données & Auth** : connexion Mongoose, modèles, Auth.js, OTP, 2FA, écrans auth.
- **Phase 3 — Moteur** : port TS de models→M1→M2→M3→répertoire + harnais de non-régression vs Python.
- **Phase 4 — Écrans métier** : Accueil, Analyser, Comparer, Répertoire, Historique.
- **Phase 5 — NARR'IA Chat** : agent AI SDK + 3 tools + streaming + réponses structurées.
- **Phase 6 — Déploiement** : Vercel + env + vérification end-to-end.

Chaque phase suivante sera détaillée en tâches bite-sized au moment de l'attaquer (le spec reste la source de vérité).

---

## Phase 1 — Fondations

### Task 1.1 : Scaffold Next.js
**Files:** Create `web/` (projet complet via CLI)

- [ ] Scaffold : `pnpm create next-app@latest web --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack` (réponses non-interactives).
- [ ] Vérifier : `cd web && pnpm dev` démarre sans erreur sur `http://localhost:3000`.
- [ ] Commit : `chore(web): scaffold Next.js 15 + TS + Tailwind`.

### Task 1.2 : Polices Quicksand + Kantumruy
**Files:** Modify `web/app/layout.tsx`, `web/app/globals.css`

- [ ] Charger Quicksand + Kantumruy Pro via `next/font/google`, exposées en variables CSS `--font-quicksand` / `--font-kantumruy`.
- [ ] Mapper dans Tailwind : `font-heading` (Quicksand), `font-body` (Kantumruy).
- [ ] Vérifier visuellement un titre + un paragraphe.
- [ ] Commit : `feat(design): polices Quicksand/Kantumruy`.

### Task 1.3 : Tokens de couleur + thème
**Files:** Modify `web/tailwind.config.ts`, `web/app/globals.css`

- [ ] Définir les CSS variables de la charte (dark-purple, purple, pink, yellow, soft-purple, soft-pink, greys, white) + extension Tailwind `colors`.
- [ ] Définir radius par défaut 16, ombres douces, fond dark par défaut.
- [ ] Page de démo `/_kitchensink` affichant la palette.
- [ ] Commit : `feat(design): tokens de couleur + thème dark`.

### Task 1.4 : Composants UI de base
**Files:** Create `web/components/ui/{button,card,badge,input,gradient-header}.tsx`

- [ ] Installer shadcn (`pnpm dlx shadcn@latest init`) puis ajouter button, card, input, badge ; restyler sur les tokens (boutons pill rose, cards radius 16).
- [ ] `GradientHeader` : bandeau dégradé violet (titre + sous-titre) repris des écrans Analyser/Comparer/Répertoire.
- [ ] Ajouter les 7 variantes de bouton du UI System sur `/_kitchensink`.
- [ ] Commit : `feat(design): composants UI (button/card/badge/input/gradient-header)`.

### Task 1.5 : Icônes Figma
**Files:** Create `web/components/icons/` (SVG exportés)

- [ ] Exporter le set d'icônes depuis Figma (via download_assets) ou utiliser `lucide-react` pour les équivalents au démarrage.
- [ ] Composant `Icon` typé par nom.
- [ ] Commit : `feat(design): set d'icônes`.

### Task 1.6 : Shell applicatif (sidebar + topbar)
**Files:** Create `web/components/shell/{sidebar,topbar,app-shell}.tsx`, `web/app/(app)/layout.tsx`

- [ ] `Sidebar` : fond dégradé violet, logo narr'ia, nav (Accueil, NARR'IA Chat, Analyser, Comparer, Historique, Projets), section « Récents », bas (Répertoire, Configuration, À propos), carte profil. État actif rose.
- [ ] `Topbar` : bouton Dashboard, recherche, Aide, notifications (badge), avatar.
- [ ] `AppShell` assemble sidebar + topbar + zone contenu ; layout `(app)`.
- [ ] Page `/(app)/accueil` placeholder pour valider le shell.
- [ ] Vérifier visuellement vs Figma (nœud Accueil 4:1641).
- [ ] Commit : `feat(shell): sidebar dégradé + topbar`.

### Phase 1 — Vérification
- [ ] `pnpm build` passe.
- [ ] Le shell + le kitchensink respectent la charte (revue visuelle).

---

## Self-review (Phase 1)
- Couverture spec §3 (design system) et §4 (architecture/arborescence) : ✓ tasks 1.1–1.6.
- Pas de placeholder bloquant ; les phases 2–6 seront détaillées à l'ouverture de chaque phase.
- Cohérence des chemins : tout sous `web/`, alias `@/*`.
