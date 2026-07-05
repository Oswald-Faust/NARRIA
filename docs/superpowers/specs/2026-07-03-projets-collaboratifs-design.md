# Projets collaboratifs — Design

Date : 2026-07-03
Statut : Approuvé

## Contexte

Nouvelle fonctionnalité NARR'IA 2.0 : des espaces de travail ("Projets") permettant de
regrouper plusieurs sessions (analyses, comparaisons, échanges NARR'IA Chat) autour d'un
même dossier — affaire de plagiat, mandat d'agent, cession de droits, etc. — seul ou en
collaboration avec d'autres utilisateurs invités (rôles, permissions, pièces jointes,
rapports consolidés).

Basé sur 3 maquettes Figma : liste des projets (dashboard), création d'un projet, détail
d'un projet. La sidebar de l'app pointe déjà vers `/projets` (nav existant, actuellement
sans page derrière).

## Décisions validées en brainstorming

- **Liaison session → projet automatique** : lancer un outil (Analyse/Comparaison/Chat)
  depuis la page projet transmet le `projectId` en contexte ; le résultat est
  automatiquement rattaché au projet. Implémentation : champ optionnel `projectId` ajouté
  aux collections `Analysis`, `Comparison`, `ChatConversation` déjà existantes — pas de
  nouvelle table de jonction, une seule source de vérité pour chaque session.
- **Invitation par email** : crée une invitation `pending` même si l'adresse n'a pas encore
  de compte. Acceptation automatique à la connexion/inscription si l'email correspond à une
  invitation en attente — aucun lien magique à gérer en plus de l'auth existante.
- **Lien d'invitation générique** : chaque projet a un lien unique (rôle par défaut
  configurable), régénérable/révocable. Désactivé automatiquement si le projet est
  confidentiel.
- **Rôles** : `owner` (créateur, seul à pouvoir supprimer le projet) / `co-admin` (mêmes
  droits que owner sauf suppression) / `collaborateur` (lance les outils, consulte, ajoute
  des pièces jointes) / `lecteur` (consultation seule).
- **Confidentialité** : désactive uniquement le lien d'invitation générique — seules les
  invitations email nominatives fonctionnent. Un projet n'est jamais public dans les deux
  cas ; seuls les membres invités y accèdent.
- **Synthèse des rapports** : réelle synthèse via Claude qui lit les résumés/scores/verdicts
  déjà stockés en base (pas les textes bruts des œuvres) et produit un texte de synthèse
  globale du dossier, stocké et régénérable.
- **Stockage des pièces jointes** : Vercel Blob (`@vercel/blob`), à provisionner au moment
  de l'implémentation (créer le store + ajouter le token en variable d'environnement).

## Modèle de données

### `Project` (`lib/db/models/project.ts`)

```
ownerId: string (index)
name: string
type: enum ["Contentieux de plagiat", "Mandat d'agent", "Cession de droits", "Autre"]
category: string (texte libre, ex. "Roman · Littérature générale")
summary: string
confidential: boolean (défaut true)
notifyOnInvite: boolean (défaut false)
inviteLinkToken: string (unique, généré à la création, régénérable)
inviteLinkRole: enum ["co-admin", "collaborateur", "lecteur"] (défaut "collaborateur")
attachments: [{ filename, url, size, mimeType, uploadedBy, uploadedAt }]
archived: boolean (défaut false)
lastSynthesis: { text: string, generatedAt: Date } | null
timestamps
```

### `ProjectMember` (`lib/db/models/project-member.ts`)

```
projectId: ObjectId (ref Project, index)
userId: string (index)
role: enum ["owner", "co-admin", "collaborateur", "lecteur"]
timestamps
```
Index unique composé `(projectId, userId)`. Le créateur est inséré avec `role: "owner"` à
la création du projet.

### `ProjectInvitation` (`lib/db/models/project-invitation.ts`)

```
projectId: ObjectId (ref Project, index)
email: string (lowercase, index)
role: enum ["co-admin", "collaborateur", "lecteur"]
status: enum ["pending", "accepted", "revoked"] (défaut "pending")
invitedByUserId: string
timestamps
```

### Collections existantes — champ ajouté

`Analysis`, `Comparison`, `ChatConversation` : `projectId: ObjectId | null` (ref Project,
index, défaut null). Aucun champ retiré, entièrement rétrocompatible.

`NOTIFICATION_TYPES` (`lib/db/models/notification.ts`) : ajout de `"project"` (invitation
reçue, rejoint un projet).

## Permissions (`lib/projects/permissions.ts`)

```typescript
type ProjectRole = "owner" | "co-admin" | "collaborateur" | "lecteur";

async function getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null>;
function canManageProject(role: ProjectRole | null): boolean;   // owner | co-admin
function canLaunchTools(role: ProjectRole | null): boolean;     // owner | co-admin | collaborateur
function canView(role: ProjectRole | null): boolean;            // tout rôle non-null
```

Chaque route API vérifie le rôle serveur-side avant toute action — jamais de contrôle
côté client seul.

## Flux d'invitation

1. **Email nominatif** : `POST /api/projects/[id]/invitations` (owner/co-admin) crée une
   `ProjectInvitation` `pending`. Si `notifyOnInvite`, envoie un email via
   `sendMail` (réutilise `lib/email/brevo.ts`, nouvelle fonction
   `sendProjectInvitationEmail`). Si l'invité a déjà un compte, une `Notification`
   (type `"project"`) est aussi créée immédiatement.
2. **Acceptation automatique** : dans `auth.ts` (callback de connexion réussie) et dans
   `POST /api/auth/register` (après création de compte), appel de
   `acceptPendingInvitationsForEmail(userId, email)` — cherche les invitations `pending`
   correspondant à l'email (insensible à la casse), crée les `ProjectMember`
   correspondants, marque les invitations `accepted`. Idempotent (ignore si déjà membre).
3. **Lien générique** : `GET /projets/rejoindre/[token]` — résout le `Project` par
   `inviteLinkToken` (404 si invalide ou si `confidential=true`, la disponibilité du lien
   étant dérivée de `!confidential` et non stockée séparément). Si non connecté,
   redirige vers `/login?callbackUrl=/projets/rejoindre/[token]`. Si connecté, crée le
   `ProjectMember` avec `inviteLinkRole` (idempotent), puis redirige vers `/projets/[id]`.

## Routes API

- `POST /api/projects` — crée le projet (name, type, category, summary, confidential,
  notifyOnInvite, invitations initiales `{email, role}[]` optionnelles) ; retourne l'`id`.
- `GET /api/projects?tab=tous|archives&q=` — liste les projets où l'utilisateur est membre,
  avec compteurs "Projets personnels" (owner) / "Collaborations" (autre rôle).
- `GET /api/projects/[id]` — détail complet : infos projet, rôle de l'utilisateur courant,
  membres, compteurs par outil (nAnalyses/nComparisons/nChatMessages), sessions récentes
  (mixées, triées par date, limitées), pièces jointes, invitations en attente (visibles
  owner/co-admin uniquement).
- `PATCH /api/projects/[id]` — met à jour les réglages (owner/co-admin).
- `DELETE /api/projects/[id]` — supprime (owner uniquement).
- `POST /api/projects/[id]/invitations`, `DELETE /api/projects/[id]/invitations/[invId]`.
- `PATCH /api/projects/[id]/members/[userId]` (changer rôle), `DELETE .../members/[userId]`
  (retirer — jamais le owner).
- `POST /api/projects/[id]/invite-link/regenerate` — régénère `inviteLinkToken`.
- `POST /api/projects/[id]/attachments` (upload vers Vercel Blob + métadonnées),
  `DELETE /api/projects/[id]/attachments/[index]`.
- `POST /api/projects/[id]/synthesis` — génère/régénère `lastSynthesis` via Claude
  (`generateText`, prompt construit à partir des résumés/scores/verdicts des
  analyses/comparaisons du projet).
- `POST /api/analyze` et `POST /api/compare` : acceptent un `projectId` optionnel dans le
  body ; si présent, vérifie `canLaunchTools(role)` (403 sinon) avant de lancer, et
  l'enregistre sur le document créé.

## Pages

- `/projets` : bannière "Projets" + bouton "Nouveau projet", 2 cartes stats (Projets
  personnels / Collaborations), onglets Tous/Archives, recherche, grille de cartes (icône
  type, titre, catégorie, avatars empilés des collaborateurs, nombre de docs, date de
  mise à jour, bouton "Ouvrir"), carte fantôme "+ Nouveau projet".
- `/projets/nouveau` : formulaire deux colonnes — Informations générales (nom*, type*,
  catégorie, résumé) + Pièces jointes (dropzone, upload différé après création) ; Inviter
  un collaborateur (email + rôle + liste des invitations en attente) + Options du projet
  (Projet confidentiel, Notifier les collaborateurs) + bouton "Créer le projet".
- `/projets/[id]` : en-tête (icône, nom, type · catégorie · date de création · N
  collaborateurs, accès "Gérer les collaborateurs" pour owner/co-admin), 3 cartes "Outils
  du projet" (Analyse de texte / Comparer deux textes / NARR'IA Chat — compteur, dernière
  utilisation, bouton Lancer/Ouvrir désactivé pour les lecteurs), "Historique des
  sessions" (onglets Sessions du projet / Mes sessions, bouton "Voir" → réutilise les
  pages `/historique/analyses/[id]` et `/historique/comparaisons/[id]` déjà existantes,
  ou `/chat?conversationId=` pour les échanges), sidebar "Rapports de résultat" (lien vers
  l'export existant) + bouton "Synthèse des rapports", "Pièces jointes" (liste + ajout).
- `/projets/rejoindre/[token]` : page de redirection du flux de lien d'invitation (pas
  de contenu visuel persistant, juste le traitement puis redirection).
- Panneau "Gérer les collaborateurs" (modale ou page dédiée `/projets/[id]/membres`,
  owner/co-admin) : inviter par email + rôle, liste des membres avec changement de
  rôle/retrait, invitations en attente avec révocation, lien d'invitation
  (copier/régénérer/activer selon confidentialité), zone danger (archiver/supprimer).

## Gestion d'erreurs

- Toute route `/api/projects/**` : 401 si non connecté, 403 si rôle insuffisant pour
  l'action, 404 si projet/ressource introuvable ou utilisateur non membre (pas de fuite
  d'existence à un non-membre).
- `/projets/rejoindre/[token]` : 404 si token invalide/désactivé, redirection propre si
  non connecté.
- Upload de pièces jointes : limite de taille (20 Mo, cohérent avec le Figma), types
  acceptés (PDF/DOCX/TXT/MP3), erreur claire si dépassement.
- Lancer un outil sans droit (lecteur) : bouton désactivé côté UI + 403 serveur si
  contourné.

## Hors scope (assumé)

- Transfert de propriété du projet à un autre membre.
- Notifications temps réel (WebSocket) sur nouvelle session ajoutée au projet.
- Édition collaborative simultanée d'un même document.
- Contrôle d'accès au niveau du fichier Blob lui-même (URL directe non protégée si
  partagée hors app — limite connue de ce MVP).

## Tests

- `lib/projects/permissions.ts` : tests unitaires purs (matrice rôle → capacité).
- `acceptPendingInvitationsForEmail` : test avec invitations pending/revoked/déjà membre.
- Génération/validation du lien d'invitation (token régénéré invalide l'ancien).
- Templates de synthèse : test de robustesse si aucun rapport dans le projet.
