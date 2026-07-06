# Projets collaboratifs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter la fonctionnalité "Projets" de NARR'IA 2.0 : espaces de travail
collaboratifs (rôles, invitations par email et par lien, pièces jointes) qui regroupent
automatiquement les analyses/comparaisons/échanges chat lancés depuis eux, avec rapports
consolidés et synthèse via IA — fidèle aux 3 maquettes Figma (liste, création, détail).

**Architecture:** 3 nouvelles collections Mongoose (`Project`, `ProjectMember`,
`ProjectInvitation`) + un champ `projectId` optionnel ajouté aux collections existantes
(`Analysis`, `Comparison`, `ChatConversation`) — pas de nouvelle table de jonction, chaque
session reste sa propre source de vérité. Un module `lib/projects/permissions.ts` centralise
toutes les vérifications de rôle, appelées côté serveur dans chaque route API. Pièces
jointes stockées sur Vercel Blob.

**Tech Stack:** Next.js 16 App Router, Mongoose 9, Auth.js 5 (session JWT existante),
`@vercel/blob` (nouveau), `nodemailer`/Brevo (déjà en place), SDK `ai`/`@ai-sdk/anthropic`
(déjà en place, pour la synthèse).

**Spec de référence :** `docs/superpowers/specs/2026-07-03-projets-collaboratifs-design.md`

---

## File Structure

**Modèles (nouveaux) :**
- `web/lib/db/models/project.ts`
- `web/lib/db/models/project-member.ts`
- `web/lib/db/models/project-invitation.ts`

**Modèles (modifiés) :**
- `web/lib/db/models/analysis.ts`, `comparison.ts`, `chat-conversation.ts` — champ `projectId`.
- `web/lib/db/models/notification.ts` — type `"project"` ajouté.

**Logique métier :**
- `web/lib/projects/permissions.ts` — rôles et capacités.
- `web/lib/projects/invitations.ts` — acceptation automatique des invitations pending.
- `web/lib/email/brevo.ts` — modifié, ajout `sendProjectInvitationEmail`.

**Routes API (nouvelles) :**
- `web/app/api/projects/route.ts` (POST créer, GET lister)
- `web/app/api/projects/[id]/route.ts` (GET détail, PATCH, DELETE)
- `web/app/api/projects/[id]/invitations/route.ts` (POST inviter)
- `web/app/api/projects/[id]/invitations/[invitationId]/route.ts` (DELETE révoquer)
- `web/app/api/projects/[id]/members/[userId]/route.ts` (PATCH rôle, DELETE retirer)
- `web/app/api/projects/[id]/invite-link/route.ts` (POST régénérer)
- `web/app/api/projects/[id]/attachments/route.ts` (POST upload)
- `web/app/api/projects/[id]/attachments/[attachmentId]/route.ts` (DELETE)
- `web/app/api/projects/[id]/synthesis/route.ts` (POST générer/régénérer)

**Routes API (modifiées) :**
- `web/app/api/analyze/route.ts`, `web/app/api/compare/route.ts`,
  `web/app/api/chat/conversations/route.ts` — `projectId` optionnel.
- `web/app/api/auth/verify-otp/route.ts`, `web/auth.ts` — appel de l'acceptation
  automatique des invitations.

**Pages (nouvelles) :**
- `web/app/(app)/projets/page.tsx` (liste)
- `web/app/(app)/projets/nouveau/page.tsx` (création)
- `web/app/(app)/projets/[id]/page.tsx` (détail)
- `web/app/(app)/projets/[id]/membres/page.tsx` (gestion collaborateurs)
- `web/app/(app)/projets/rejoindre/[token]/page.tsx` (lien d'invitation, Server Component)

**Tests (nouveaux) :**
- `web/tests/projects/permissions.test.ts`
- `web/tests/projects/invitations.test.ts`

---

### Task P1 : Modèles Project / ProjectMember / ProjectInvitation + permissions

**Files:**
- Create: `web/lib/db/models/project.ts`
- Create: `web/lib/db/models/project-member.ts`
- Create: `web/lib/db/models/project-invitation.ts`
- Create: `web/lib/projects/permissions.ts`
- Test: `web/tests/projects/permissions.test.ts`

- [ ] **Step 1 : Créer le modèle `Project`**

```typescript
// web/lib/db/models/project.ts
import { Schema, model, models } from "mongoose";

export const PROJECT_TYPES = [
  "Contentieux de plagiat",
  "Mandat d'agent",
  "Cession de droits",
  "Autre",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

const ProjectAttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, default: "" },
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ProjectSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: PROJECT_TYPES, default: "Autre" },
    category: { type: String, default: "" },
    summary: { type: String, default: "" },
    confidential: { type: Boolean, default: true },
    notifyOnInvite: { type: Boolean, default: false },
    inviteLinkToken: { type: String, required: true, unique: true },
    inviteLinkRole: {
      type: String,
      enum: ["co-admin", "collaborateur", "lecteur"],
      default: "collaborateur",
    },
    attachments: { type: [ProjectAttachmentSchema], default: [] },
    archived: { type: Boolean, default: false },
    lastSynthesis: {
      text: { type: String, default: "" },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

export const Project = models.Project || model("Project", ProjectSchema);
```

- [ ] **Step 2 : Créer le modèle `ProjectMember`**

```typescript
// web/lib/db/models/project-member.ts
import { Schema, model, models } from "mongoose";

export const PROJECT_ROLES = ["owner", "co-admin", "collaborateur", "lecteur"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

const ProjectMemberSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: PROJECT_ROLES, required: true },
  },
  { timestamps: true },
);

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMember = models.ProjectMember || model("ProjectMember", ProjectMemberSchema);
```

- [ ] **Step 3 : Créer le modèle `ProjectInvitation`**

```typescript
// web/lib/db/models/project-invitation.ts
import { Schema, model, models } from "mongoose";

const ProjectInvitationSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ["co-admin", "collaborateur", "lecteur"], required: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    invitedByUserId: { type: String, required: true },
  },
  { timestamps: true },
);

export const ProjectInvitation =
  models.ProjectInvitation || model("ProjectInvitation", ProjectInvitationSchema);
```

- [ ] **Step 4 : Écrire le test des permissions (échoue)**

```typescript
// web/tests/projects/permissions.test.ts
import { describe, it, expect } from "vitest";
import { canManageProject, canLaunchTools, canView } from "@/lib/projects/permissions";

describe("canManageProject", () => {
  it("autorise owner et co-admin", () => {
    expect(canManageProject("owner")).toBe(true);
    expect(canManageProject("co-admin")).toBe(true);
  });
  it("refuse collaborateur, lecteur et non-membre", () => {
    expect(canManageProject("collaborateur")).toBe(false);
    expect(canManageProject("lecteur")).toBe(false);
    expect(canManageProject(null)).toBe(false);
  });
});

describe("canLaunchTools", () => {
  it("autorise owner, co-admin et collaborateur", () => {
    expect(canLaunchTools("owner")).toBe(true);
    expect(canLaunchTools("co-admin")).toBe(true);
    expect(canLaunchTools("collaborateur")).toBe(true);
  });
  it("refuse lecteur et non-membre", () => {
    expect(canLaunchTools("lecteur")).toBe(false);
    expect(canLaunchTools(null)).toBe(false);
  });
});

describe("canView", () => {
  it("autorise tout rôle non-null", () => {
    expect(canView("owner")).toBe(true);
    expect(canView("lecteur")).toBe(true);
  });
  it("refuse non-membre", () => {
    expect(canView(null)).toBe(false);
  });
});
```

- [ ] **Step 5 : Lancer le test, vérifier qu'il échoue**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx vitest run tests/projects/permissions.test.ts`
Expected: FAIL (module introuvable)

- [ ] **Step 6 : Implémenter `lib/projects/permissions.ts`**

```typescript
// web/lib/projects/permissions.ts
import { connectDB } from "@/lib/db/mongoose";
import { ProjectMember, type ProjectRole } from "@/lib/db/models/project-member";
import { Project } from "@/lib/db/models/project";

export type { ProjectRole };

/** Résout le rôle de l'utilisateur sur un projet, ou `null` s'il n'en est pas membre. */
export async function getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  await connectDB();
  const member = await ProjectMember.findOne({ projectId, userId }).lean();
  return (member?.role as ProjectRole | undefined) ?? null;
}

/** Owner et co-admin : gestion des collaborateurs, réglages, archivage. Seul owner supprime. */
export function canManageProject(role: ProjectRole | null): boolean {
  return role === "owner" || role === "co-admin";
}

/** Owner, co-admin, collaborateur : peuvent lancer Analyse/Comparaison/Chat et ajouter des pièces jointes. */
export function canLaunchTools(role: ProjectRole | null): boolean {
  return role === "owner" || role === "co-admin" || role === "collaborateur";
}

/** Tout membre (y compris lecteur) peut consulter historique/rapports/pièces jointes. */
export function canView(role: ProjectRole | null): boolean {
  return role !== null;
}

/** Seul le owner peut supprimer le projet. */
export function canDeleteProject(role: ProjectRole | null): boolean {
  return role === "owner";
}

/** Génère un token de lien d'invitation (hex 32 caractères). */
export function generateInviteLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Un projet confidentiel désactive le lien d'invitation générique (dérivé, pas stocké). */
export function isInviteLinkActive(project: { confidential: boolean }): boolean {
  return !project.confidential;
}
```

- [ ] **Step 7 : Lancer le test, vérifier qu'il passe**

Run: `npx vitest run tests/projects/permissions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 8 : Vérifications**

Run: `npx tsc --noEmit -p . && npx eslint lib/db/models/project.ts lib/db/models/project-member.ts lib/db/models/project-invitation.ts lib/projects/permissions.ts tests/projects/permissions.test.ts`
Expected: 0 erreur

- [ ] **Step 9 : Commit**

```bash
git add lib/db/models/project.ts lib/db/models/project-member.ts lib/db/models/project-invitation.ts lib/projects/permissions.ts tests/projects/permissions.test.ts
git commit -m "feat(projets): modèles Project/ProjectMember/ProjectInvitation + permissions"
```

---

### Task P2 : `projectId` sur Analysis/Comparison/ChatConversation + notification "project"

**Files:**
- Modify: `web/lib/db/models/analysis.ts`
- Modify: `web/lib/db/models/comparison.ts`
- Modify: `web/lib/db/models/chat-conversation.ts`
- Modify: `web/lib/db/models/notification.ts`

- [ ] **Step 1 : Ajouter `projectId` à `Analysis`**

Dans `web/lib/db/models/analysis.ts`, ajoute au schéma existant (juste après `sourceFile`,
sans retirer aucun champ existant) :

```typescript
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
```

- [ ] **Step 2 : Ajouter `projectId` à `Comparison`**

Dans `web/lib/db/models/comparison.ts`, ajoute au schéma existant :

```typescript
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
```

- [ ] **Step 3 : Ajouter `projectId` à `ChatConversation`**

Dans `web/lib/db/models/chat-conversation.ts`, ajoute au schéma existant :

```typescript
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
```

- [ ] **Step 4 : Ajouter le type de notification `"project"`**

Dans `web/lib/db/models/notification.ts`, modifie le tableau `NOTIFICATION_TYPES` :

```typescript
export const NOTIFICATION_TYPES = [
  "analysis",
  "comparison",
  "ip",
  "repertoire",
  "export",
  "project",  // invitation reçue / a rejoint un projet
  "system",
] as const;
```

- [ ] **Step 5 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx vitest run`
Expected: 0 erreur, tous les tests existants passent (aucune régression — champs ajoutés
sont optionnels avec valeur par défaut).

- [ ] **Step 6 : Commit**

```bash
git add lib/db/models/analysis.ts lib/db/models/comparison.ts lib/db/models/chat-conversation.ts lib/db/models/notification.ts
git commit -m "feat(projets): ajoute projectId optionnel aux sessions + type de notification project"
```

---

### Task P3 : Acceptation automatique des invitations + email

**Files:**
- Create: `web/lib/projects/invitations.ts`
- Modify: `web/lib/email/brevo.ts`
- Modify: `web/app/api/auth/verify-otp/route.ts`
- Modify: `web/auth.ts`
- Test: `web/tests/projects/invitations.test.ts`

- [ ] **Step 1 : Écrire le test d'acceptation (échoue)**

Ce test utilise une base MongoDB réelle si `MONGODB_URI` est configurée dans
l'environnement de test ; sinon vérifie au moins que la fonction est bien exportée et
gère un email sans invitation sans erreur. Pour rester déterministe sans dépendre d'une
vraie base, le test mocke `ProjectInvitation`/`ProjectMember` via `vi.mock`.

```typescript
// web/tests/projects/invitations.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const invitationDocs: { _id: string; email: string; role: string; status: string; projectId: string }[] = [];
const memberDocs: { projectId: string; userId: string; role: string }[] = [];

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/db/models/project-invitation", () => ({
  ProjectInvitation: {
    find: vi.fn(({ email, status }: { email: string; status: string }) =>
      Promise.resolve(invitationDocs.filter((i) => i.email === email && i.status === status)),
    ),
    updateOne: vi.fn(({ _id }: { _id: string }, update: { $set: { status: string } }) => {
      const doc = invitationDocs.find((i) => i._id === _id);
      if (doc) doc.status = update.$set.status;
      return Promise.resolve({});
    }),
  },
}));

vi.mock("@/lib/db/models/project-member", () => ({
  ProjectMember: {
    findOne: vi.fn(({ projectId, userId }: { projectId: string; userId: string }) =>
      Promise.resolve(memberDocs.find((m) => m.projectId === projectId && m.userId === userId) ?? null),
    ),
    create: vi.fn((doc: { projectId: string; userId: string; role: string }) => {
      memberDocs.push(doc);
      return Promise.resolve(doc);
    }),
  },
}));

import { acceptPendingInvitationsForEmail } from "@/lib/projects/invitations";

beforeEach(() => {
  invitationDocs.length = 0;
  memberDocs.length = 0;
});

describe("acceptPendingInvitationsForEmail", () => {
  it("crée un ProjectMember pour chaque invitation pending correspondant à l'email", async () => {
    invitationDocs.push({ _id: "inv1", email: "alice@test.fr", role: "collaborateur", status: "pending", projectId: "p1" });
    await acceptPendingInvitationsForEmail("user1", "alice@test.fr");
    expect(memberDocs).toEqual([{ projectId: "p1", userId: "user1", role: "collaborateur" }]);
    expect(invitationDocs[0].status).toBe("accepted");
  });

  it("ignore les invitations déjà revoked/accepted (le find les exclut déjà par status)", async () => {
    invitationDocs.push({ _id: "inv2", email: "bob@test.fr", role: "lecteur", status: "revoked", projectId: "p2" });
    await acceptPendingInvitationsForEmail("user2", "bob@test.fr");
    expect(memberDocs).toHaveLength(0);
  });

  it("est idempotent si l'utilisateur est déjà membre du projet", async () => {
    memberDocs.push({ projectId: "p3", userId: "user3", role: "collaborateur" });
    invitationDocs.push({ _id: "inv3", email: "carl@test.fr", role: "co-admin", status: "pending", projectId: "p3" });
    await acceptPendingInvitationsForEmail("user3", "carl@test.fr");
    // Toujours un seul membre, pas de doublon, mais l'invitation est bien marquée acceptée.
    expect(memberDocs.filter((m) => m.projectId === "p3" && m.userId === "user3")).toHaveLength(1);
    expect(invitationDocs[0].status).toBe("accepted");
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx vitest run tests/projects/invitations.test.ts`
Expected: FAIL (module `@/lib/projects/invitations` introuvable)

- [ ] **Step 3 : Implémenter `lib/projects/invitations.ts`**

```typescript
// web/lib/projects/invitations.ts
import { connectDB } from "@/lib/db/mongoose";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { ProjectMember } from "@/lib/db/models/project-member";

/**
 * Accepte automatiquement toutes les invitations `pending` correspondant à cet email :
 * crée le `ProjectMember` (idempotent si déjà membre) et marque l'invitation `accepted`.
 * Appelée à la connexion et juste après vérification de l'email à l'inscription.
 */
export async function acceptPendingInvitationsForEmail(userId: string, email: string): Promise<void> {
  await connectDB();
  const normalizedEmail = email.toLowerCase().trim();
  const pending = await ProjectInvitation.find({ email: normalizedEmail, status: "pending" });

  for (const invitation of pending) {
    const projectId = String(invitation.projectId);
    const existing = await ProjectMember.findOne({ projectId, userId });
    if (!existing) {
      await ProjectMember.create({ projectId, userId, role: invitation.role });
    }
    await ProjectInvitation.updateOne({ _id: invitation._id }, { $set: { status: "accepted" } });
  }
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run: `npx vitest run tests/projects/invitations.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5 : Ajouter `sendProjectInvitationEmail` dans `lib/email/brevo.ts`**

Ajoute cette fonction à la fin du fichier `web/lib/email/brevo.ts` (ne touche à rien
d'autre) :

```typescript
export async function sendProjectInvitationEmail(email: string, projectName: string, inviterName: string) {
  const subject = `${inviterName} vous invite à rejoindre le projet « ${projectName} » sur NARR'IA`;
  const text = [
    "Bonjour,",
    "",
    `${inviterName} vous invite à rejoindre le projet « ${projectName} » sur NARR'IA.`,
    "",
    "Connectez-vous à votre compte NARR'IA (ou créez-en un avec cette adresse e-mail) pour rejoindre automatiquement le projet.",
    "",
    "L'equipe NARR'IA",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16111f;">
      <p>Bonjour,</p>
      <p><strong>${inviterName}</strong> vous invite à rejoindre le projet « <strong>${projectName}</strong> » sur NARR'IA.</p>
      <p>Connectez-vous à votre compte NARR'IA (ou créez-en un avec cette adresse e-mail) pour rejoindre automatiquement le projet.</p>
      <p>L'equipe NARR'IA</p>
    </div>
  `;

  await sendMail({ to: email, subject, text, html });
}
```

- [ ] **Step 6 : Brancher l'acceptation automatique dans `verify-otp`**

Dans `web/app/api/auth/verify-otp/route.ts`, ajoute l'import et l'appel juste après
`await user.save();` :

```typescript
import { acceptPendingInvitationsForEmail } from "@/lib/projects/invitations";
```

```typescript
  user.emailVerified = true;
  user.otp = { code: null, expiresAt: null };
  await user.save();

  await acceptPendingInvitationsForEmail(String(user._id), user.email);

  return NextResponse.json({ ok: true });
```

- [ ] **Step 7 : Brancher l'acceptation automatique dans `auth.ts` (connexion)**

Dans `web/auth.ts`, ajoute l'import et l'appel juste après le `await logLogin(...)` de
connexion réussie (avant le `return { id: ... }`) :

```typescript
import { acceptPendingInvitationsForEmail } from "@/lib/projects/invitations";
```

```typescript
        // Connexion réussie : trace + compteurs.
        await logLogin({ ownerId: String(user._id), email: user.email, success: true }, req);
        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } },
        );
        await acceptPendingInvitationsForEmail(String(user._id), user.email);

        return {
```

- [ ] **Step 8 : Vérifications**

Run: `npx tsc --noEmit -p . && npx eslint lib/projects/invitations.ts lib/email/brevo.ts app/api/auth/verify-otp/route.ts auth.ts tests/projects/invitations.test.ts && npx vitest run`
Expected: 0 erreur, tous les tests passent

- [ ] **Step 9 : Commit**

```bash
git add lib/projects/invitations.ts lib/email/brevo.ts app/api/auth/verify-otp/route.ts auth.ts tests/projects/invitations.test.ts
git commit -m "feat(projets): acceptation automatique des invitations pending (connexion/inscription)"
```

---

### Task P4 : Routes API — CRUD Project

**Files:**
- Create: `web/app/api/projects/route.ts`
- Create: `web/app/api/projects/[id]/route.ts`

- [ ] **Step 1 : Route liste + création**

```typescript
// web/app/api/projects/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project, PROJECT_TYPES } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { generateInviteLinkToken } from "@/lib/projects/permissions";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "tous";
  const q = url.searchParams.get("q")?.trim() ?? "";

  await connectDB();
  const memberships = await ProjectMember.find({ userId }).lean();
  const projectIds = memberships.map((m) => m.projectId);
  const roleByProjectId = new Map(memberships.map((m) => [String(m.projectId), m.role]));

  const filter: Record<string, unknown> = { _id: { $in: projectIds } };
  filter.archived = tab === "archives";
  if (q) filter.name = { $regex: q, $options: "i" };

  const projects = await Project.find(filter).sort({ updatedAt: -1 }).lean();

  const nPersonal = memberships.filter((m) => m.role === "owner").length;
  const nCollaborations = memberships.filter((m) => m.role !== "owner").length;

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: String(p._id),
      name: p.name,
      type: p.type,
      category: p.category,
      role: roleByProjectId.get(String(p._id)) ?? null,
      nDocuments: p.attachments?.length ?? 0,
      updatedAt: p.updatedAt,
    })),
    nPersonal,
    nCollaborations,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name: string = body?.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Le nom du projet est requis." }, { status: 400 });
  }
  const type = PROJECT_TYPES.includes(body?.type) ? body.type : "Autre";
  const category: string = body?.category?.trim() ?? "";
  const summary: string = body?.summary?.trim() ?? "";
  const confidential: boolean = body?.confidential !== false;
  const notifyOnInvite: boolean = body?.notifyOnInvite === true;
  const invitations: { email: string; role: string }[] = Array.isArray(body?.invitations) ? body.invitations : [];

  await connectDB();
  const ownerId = session.user.id;
  const project = await Project.create({
    ownerId,
    name,
    type,
    category,
    summary,
    confidential,
    notifyOnInvite,
    inviteLinkToken: generateInviteLinkToken(),
  });

  await ProjectMember.create({ projectId: project._id, userId: ownerId, role: "owner" });

  for (const inv of invitations) {
    const email = inv.email?.trim().toLowerCase();
    const role = ["co-admin", "collaborateur", "lecteur"].includes(inv.role) ? inv.role : "collaborateur";
    if (!email) continue;
    await ProjectInvitation.create({ projectId: project._id, email, role, invitedByUserId: ownerId });
  }

  return NextResponse.json({ id: String(project._id) });
}
```

- [ ] **Step 2 : Route détail / mise à jour / suppression**

```typescript
// web/app/api/projects/[id]/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project, PROJECT_TYPES } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { ChatConversation } from "@/lib/db/models/chat-conversation";
import { getProjectRole, canManageProject, canDeleteProject } from "@/lib/projects/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }

  const role = await getProjectRole(id, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const members = await ProjectMember.find({ projectId: id }).lean();
  const [nAnalyses, nComparisons, nChats] = await Promise.all([
    Analysis.countDocuments({ projectId: id }),
    Comparison.countDocuments({ projectId: id }),
    ChatConversation.countDocuments({ projectId: id }),
  ]);

  const [recentAnalyses, recentComparisons, recentChats] = await Promise.all([
    Analysis.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).select("title author ownerId createdAt").lean(),
    Comparison.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).select("refTitle candTitle ownerId createdAt").lean(),
    ChatConversation.find({ projectId: id }).sort({ createdAt: -1 }).limit(20).select("title ownerId createdAt").lean(),
  ]);

  const sessions = [
    ...recentAnalyses.map((a) => ({ kind: "analysis" as const, id: String(a._id), title: a.title, ownerId: a.ownerId, createdAt: a.createdAt })),
    ...recentComparisons.map((c) => ({ kind: "comparison" as const, id: String(c._id), title: `${c.refTitle} vs ${c.candTitle}`, ownerId: c.ownerId, createdAt: c.createdAt })),
    ...recentChats.map((c) => ({ kind: "chat" as const, id: String(c._id), title: c.title, ownerId: c.ownerId, createdAt: c.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const invitations = canManageProject(role)
    ? await ProjectInvitation.find({ projectId: id, status: "pending" }).lean()
    : [];

  return NextResponse.json({
    id: String(project._id),
    name: project.name,
    type: project.type,
    category: project.category,
    summary: project.summary,
    confidential: project.confidential,
    notifyOnInvite: project.notifyOnInvite,
    archived: project.archived,
    createdAt: project.createdAt,
    attachments: project.attachments,
    lastSynthesis: project.lastSynthesis,
    inviteLinkToken: canManageProject(role) ? project.inviteLinkToken : null,
    role,
    members: members.map((m) => ({ userId: m.userId, role: m.role })),
    counts: { analyses: nAnalyses, comparisons: nComparisons, chats: nChats },
    sessions,
    pendingInvitations: invitations.map((i) => ({ id: String(i._id), email: i.email, role: i.role })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (PROJECT_TYPES.includes(body?.type)) update.type = body.type;
  if (typeof body?.category === "string") update.category = body.category.trim();
  if (typeof body?.summary === "string") update.summary = body.summary.trim();
  if (typeof body?.confidential === "boolean") update.confidential = body.confidential;
  if (typeof body?.notifyOnInvite === "boolean") update.notifyOnInvite = body.notifyOnInvite;
  if (typeof body?.archived === "boolean") update.archived = body.archived;

  await connectDB();
  await Project.updateOne({ _id: id }, { $set: update });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }
  if (!canDeleteProject(role)) {
    return NextResponse.json({ error: "Seul le propriétaire peut supprimer le projet." }, { status: 403 });
  }

  await connectDB();
  await Promise.all([
    Project.deleteOne({ _id: id }),
    ProjectMember.deleteMany({ projectId: id }),
    ProjectInvitation.deleteMany({ projectId: id }),
  ]);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx eslint app/api/projects/route.ts "app/api/projects/[id]/route.ts" && npx vitest run`
Expected: 0 erreur, aucune régression

- [ ] **Step 4 : Commit**

```bash
git add app/api/projects/route.ts "app/api/projects/[id]/route.ts"
git commit -m "feat(projets): routes API CRUD (liste, création, détail, réglages, suppression)"
```

---

### Task P5 : Invitations, membres, lien d'invitation

**Files:**
- Create: `web/app/api/projects/[id]/invitations/route.ts`
- Create: `web/app/api/projects/[id]/invitations/[invitationId]/route.ts`
- Create: `web/app/api/projects/[id]/members/[userId]/route.ts`
- Create: `web/app/api/projects/[id]/invite-link/route.ts`
- Create: `web/app/(app)/projets/rejoindre/[token]/page.tsx`

- [ ] **Step 1 : Route d'invitation par email**

```typescript
// web/app/api/projects/[id]/invitations/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { User } from "@/lib/db/models/user";
import { getProjectRole, canManageProject } from "@/lib/projects/permissions";
import { createNotification } from "@/lib/notifications";
import { sendProjectInvitationEmail } from "@/lib/email/brevo";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email: string = body?.email?.trim().toLowerCase() ?? "";
  const inviteRole = ["co-admin", "collaborateur", "lecteur"].includes(body?.role) ? body.role : "collaborateur";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const invitation = await ProjectInvitation.create({
    projectId: id,
    email,
    role: inviteRole,
    invitedByUserId: session.user.id,
  });

  const invitedUser = await User.findOne({ email }).lean();
  if (invitedUser) {
    await createNotification({
      ownerId: String(invitedUser._id),
      type: "project",
      title: `Invitation à rejoindre « ${project.name} »`,
      body: `${session.user.name ?? "Un membre"} vous invite en tant que ${inviteRole}.`,
      href: `/projets/${id}`,
    });
  }

  if (project.notifyOnInvite) {
    try {
      await sendProjectInvitationEmail(email, project.name, session.user.name ?? "Un membre NARR'IA");
    } catch (e) {
      console.error("[projects] envoi de l'invitation par e-mail échoué:", e);
    }
  }

  return NextResponse.json({ id: String(invitation._id), email, role: inviteRole });
}
```

- [ ] **Step 2 : Route de révocation**

```typescript
// web/app/api/projects/[id]/invitations/[invitationId]/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { ProjectInvitation } from "@/lib/db/models/project-invitation";
import { getProjectRole, canManageProject } from "@/lib/projects/permissions";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, invitationId } = await params;
  if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(invitationId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  await connectDB();
  await ProjectInvitation.updateOne(
    { _id: invitationId, projectId: id },
    { $set: { status: "revoked" } },
  );
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3 : Route de gestion des membres (rôle / retrait)**

```typescript
// web/app/api/projects/[id]/members/[userId]/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { ProjectMember } from "@/lib/db/models/project-member";
import { getProjectRole, canManageProject } from "@/lib/projects/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, userId } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const newRole = body?.role;
  if (!["co-admin", "collaborateur", "lecteur"].includes(newRole)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  await connectDB();
  const target = await ProjectMember.findOne({ projectId: id, userId });
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Le rôle du propriétaire ne peut pas être modifié." }, { status: 403 });
  }
  await ProjectMember.updateOne({ projectId: id, userId }, { $set: { role: newRole } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, userId } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  await connectDB();
  const target = await ProjectMember.findOne({ projectId: id, userId });
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Le propriétaire ne peut pas être retiré du projet." }, { status: 403 });
  }
  await ProjectMember.deleteOne({ projectId: id, userId });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4 : Route de régénération du lien d'invitation**

```typescript
// web/app/api/projects/[id]/invite-link/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { getProjectRole, canManageProject, generateInviteLinkToken } from "@/lib/projects/permissions";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canManageProject(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = { inviteLinkToken: generateInviteLinkToken() };
  if (["co-admin", "collaborateur", "lecteur"].includes(body?.inviteLinkRole)) {
    update.inviteLinkRole = body.inviteLinkRole;
  }

  await connectDB();
  const project = await Project.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  return NextResponse.json({ inviteLinkToken: project?.inviteLinkToken });
}
```

- [ ] **Step 5 : Page de résolution du lien d'invitation**

```tsx
// web/app/(app)/projets/rejoindre/[token]/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { ProjectMember } from "@/lib/db/models/project-member";
import { Card } from "@/components/ui/card";

export default async function JoinProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  // Le middleware (proxy.ts) redirige déjà vers /login si non connecté, donc session existe ici.
  const userId = session!.user!.id!;

  await connectDB();
  const project = await Project.findOne({ inviteLinkToken: token }).lean();

  if (!project || project.confidential) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="text-sm text-red-400">
          Ce lien d&apos;invitation est invalide, expiré, ou le projet est confidentiel.
          <div className="mt-3">
            <Link href="/projets" className="text-soft-pink underline">Retour à mes projets</Link>
          </div>
        </Card>
      </div>
    );
  }

  const existing = await ProjectMember.findOne({ projectId: project._id, userId });
  if (!existing) {
    await ProjectMember.create({ projectId: project._id, userId, role: project.inviteLinkRole });
  }

  redirect(`/projets/${String(project._id)}`);
}
```

- [ ] **Step 6 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx eslint app/api/projects/**/*.ts "app/(app)/projets/rejoindre/[token]/page.tsx" && npx vitest run`
Expected: 0 erreur, aucune régression

- [ ] **Step 7 : Commit**

```bash
git add app/api/projects/[id]/invitations app/api/projects/[id]/members "app/api/projects/[id]/invite-link" "app/(app)/projets/rejoindre"
git commit -m "feat(projets): invitations email, gestion des membres, lien d'invitation générique"
```

---

### Task P6 : Pièces jointes (Vercel Blob)

**Files:**
- Modify: `web/package.json` (nouvelle dépendance)
- Create: `web/app/api/projects/[id]/attachments/route.ts`
- Create: `web/app/api/projects/[id]/attachments/[attachmentId]/route.ts`

- [ ] **Step 1 : Installer `@vercel/blob`**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && pnpm add @vercel/blob`

- [ ] **Step 2 : Provisionner le store (action manuelle, à faire une fois)**

Cette étape ne peut pas être scriptée : depuis le dashboard Vercel du projet (ou
`vercel blob store add` en CLI), crée un store Blob puis ajoute la variable
d'environnement `BLOB_READ_WRITE_TOKEN` en local (`.env.local`) et sur Vercel
(Production + Development). Sans ce token, les routes d'upload répondront 500 — c'est
un pré-requis d'infrastructure, pas un bug de code.

- [ ] **Step 3 : Route d'upload**

```typescript
// web/app/api/projects/[id]/attachments/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { getProjectRole, canLaunchTools } from "@/lib/projects/permissions";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 Mo (cohérent avec la maquette)
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".mp3"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canLaunchTools(role)) {
    return NextResponse.json({ error: "Droits insuffisants pour ajouter une pièce jointe." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
  }
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Format non supporté. Formats acceptés : ${ALLOWED_EXTENSIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  const blob = await put(`projects/${id}/${Date.now()}-${file.name}`, file, { access: "public" });

  const attachment = {
    id: crypto.randomUUID(),
    filename: file.name,
    url: blob.url,
    size: file.size,
    mimeType: file.type,
    uploadedBy: session.user.id,
    uploadedAt: new Date(),
  };

  await connectDB();
  await Project.updateOne({ _id: id }, { $push: { attachments: attachment } });

  return NextResponse.json({ attachment });
}
```

- [ ] **Step 4 : Route de suppression**

```typescript
// web/app/api/projects/[id]/attachments/[attachmentId]/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { getProjectRole, canLaunchTools } from "@/lib/projects/permissions";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id, attachmentId } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canLaunchTools(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  const attachment = project?.attachments?.find((a) => a.id === attachmentId);
  if (!attachment) {
    return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  }

  try {
    await del(attachment.url);
  } catch (e) {
    console.error("[projects] suppression du blob échouée (on retire quand même la référence):", e);
  }
  await Project.updateOne({ _id: id }, { $pull: { attachments: { id: attachmentId } } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx eslint "app/api/projects/[id]/attachments/route.ts" "app/api/projects/[id]/attachments/[attachmentId]/route.ts"`
Expected: 0 erreur

- [ ] **Step 6 : Commit**

```bash
git add package.json pnpm-lock.yaml "app/api/projects/[id]/attachments"
git commit -m "feat(projets): pièces jointes via Vercel Blob (upload + suppression)"
```

---

### Task P7 : Synthèse des rapports via IA

**Files:**
- Create: `web/app/api/projects/[id]/synthesis/route.ts`

- [ ] **Step 1 : Route de génération/régénération**

```typescript
// web/app/api/projects/[id]/synthesis/route.ts
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Project } from "@/lib/db/models/project";
import { Analysis } from "@/lib/db/models/analysis";
import { Comparison } from "@/lib/db/models/comparison";
import { getProjectRole, canView } from "@/lib/projects/permissions";
import { EXTRACTION_MODEL_ID } from "@/lib/engine/extraction/llm-extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }
  const role = await getProjectRole(id, session.user.id);
  if (!role) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (!canView(role)) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé ANTHROPIC_API_KEY manquante côté serveur." }, { status: 503 });
  }

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const [analyses, comparisons] = await Promise.all([
    Analysis.find({ projectId: id }).select("title author summary genre tradition").lean(),
    Comparison.find({ projectId: id }).select("refTitle candTitle scores srjLevel modality verdict").lean(),
  ]);

  if (analyses.length === 0 && comparisons.length === 0) {
    return NextResponse.json(
      { error: "Aucun rapport dans ce projet pour le moment — lancez une analyse ou une comparaison." },
      { status: 400 },
    );
  }

  const analysesText = analyses
    .map((a) => `- Analyse « ${a.title} » (${a.author}) : genre ${a.genre || "?"}, tradition ${a.tradition || "?"}. Résumé : ${a.summary || "non disponible"}`)
    .join("\n");
  const comparisonsText = comparisons
    .map((c) => `- Comparaison « ${c.refTitle} » vs « ${c.candTitle} » : SNS ${c.scores?.sns?.toFixed(2) ?? "?"}, risque ${c.srjLevel}, modalité ${c.modality}. Verdict : ${c.verdict}`)
    .join("\n");

  const prompt = `Voici les rapports narratologiques du projet « ${project.name} » (${project.type}) :

${analysesText ? `Analyses :\n${analysesText}\n` : ""}
${comparisonsText ? `Comparaisons :\n${comparisonsText}\n` : ""}

Rédige une synthèse globale du dossier en 3-4 paragraphes : tendances communes, points de
convergence entre les différentes analyses/comparaisons, et une recommandation prudente sur
la suite à donner (rappelle que ce n'est jamais une preuve juridique). Réponds en français,
sans préambule.`;

  const result = await generateText({ model: anthropic(EXTRACTION_MODEL_ID), prompt });
  const text = result.text.trim();

  await Project.updateOne({ _id: id }, { $set: { lastSynthesis: { text, generatedAt: new Date() } } });

  return NextResponse.json({ text, generatedAt: new Date().toISOString() });
}
```

- [ ] **Step 2 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx eslint "app/api/projects/[id]/synthesis/route.ts"`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add "app/api/projects/[id]/synthesis"
git commit -m "feat(projets): synthèse des rapports via IA"
```

---

### Task P8 : `projectId` dans /api/analyze, /api/compare, /api/chat/conversations

**Files:**
- Modify: `web/app/api/analyze/route.ts`
- Modify: `web/app/api/compare/route.ts`
- Modify: `web/app/api/chat/conversations/route.ts`

- [ ] **Step 1 : `/api/analyze` accepte `projectId`**

Dans `web/app/api/analyze/route.ts`, ajoute l'import et la vérification juste après la
lecture du body existant (`sourceFile`), puis passe `projectId` à `Analysis.create` :

```typescript
import { Types } from "mongoose";
import { getProjectRole, canLaunchTools } from "@/lib/projects/permissions";
```

```typescript
  const sourceFile = body?.sourceFile ?? null;
  const projectId: string | null = typeof body?.projectId === "string" && Types.ObjectId.isValid(body.projectId) ? body.projectId : null;

  if (projectId) {
    const projectRole = await getProjectRole(projectId, session.user.id);
    if (!canLaunchTools(projectRole)) {
      return NextResponse.json({ error: "Droits insuffisants sur ce projet." }, { status: 403 });
    }
  }
```

Puis dans l'objet passé à `Analysis.create({ ... })`, ajoute le champ :

```typescript
          sourceFile,
          projectId,
```

- [ ] **Step 2 : `/api/compare` accepte `projectId`**

Même principe dans `web/app/api/compare/route.ts` : ajoute les imports
`Types`/`getProjectRole`/`canLaunchTools`, lis `projectId` depuis le body juste après
`candSourceFile`, vérifie la permission, et ajoute `projectId` dans l'objet passé à
`Comparison.create({ ... })`.

- [ ] **Step 3 : `/api/chat/conversations` (POST) accepte `projectId`**

Lis `web/app/api/chat/conversations/route.ts` en entier, puis ajoute la lecture de
`projectId` (même validation `Types.ObjectId.isValid`, pas de vérification de permission
supplémentaire ici car une conversation chat n'est pas un "lancement d'outil" au sens
strict — mais ajoute-la par cohérence si tu préfères, à ton jugement) et passe-le à
`ChatConversation.create({ ownerId, title, messages: [], lastMessageAt: new Date(), projectId })`.

- [ ] **Step 4 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx vitest run && pnpm build`
Expected: 0 erreur, aucune régression, build complet réussi

- [ ] **Step 5 : Commit**

```bash
git add app/api/analyze/route.ts app/api/compare/route.ts app/api/chat/conversations/route.ts
git commit -m "feat(projets): projectId optionnel sur /api/analyze, /api/compare, /api/chat/conversations"
```

---

### Task P9 : Pages `/projets` (liste) et `/projets/nouveau` (création)

**Files:**
- Create: `web/app/(app)/projets/page.tsx`
- Create: `web/app/(app)/projets/nouveau/page.tsx`

- [ ] **Step 1 : Page liste**

```tsx
// web/app/(app)/projets/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Users, Search, Plus } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProjectItem {
  id: string;
  name: string;
  type: string;
  category: string;
  role: string | null;
  nDocuments: number;
  updatedAt: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

export default function ProjectsPage() {
  const [tab, setTab] = useState<"tous" | "archives">("tous");
  const [q, setQ] = useState("");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [nPersonal, setNPersonal] = useState(0);
  const [nCollaborations, setNCollaborations] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ tab, q });
    fetch(`/api/projects?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        setNPersonal(d.nPersonal ?? 0);
        setNCollaborations(d.nCollaborations ?? 0);
      })
      .finally(() => setLoading(false));
  }, [tab, q]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title="Projets"
        subtitle="Organisez votre travail par dossiers complexes — affaires de plagiat, contentieux éditoriaux, mandats d'agents. Un espace dédié à chaque mission."
        icon={<FolderKanban className="h-6 w-6" />}
        action={
          <Link href="/projets/nouveau">
            <Button variant="primary">
              <Plus className="h-4 w-4" /> Nouveau projet
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-purple/15">
            <FolderKanban className="h-5 w-5 text-soft-purple" />
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">{nPersonal}</p>
            <p className="text-sm text-muted">Projets personnels</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-pink/15">
            <Users className="h-5 w-5 text-soft-pink" />
          </div>
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">{nCollaborations}</p>
            <p className="text-sm text-muted">Collaborations</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["tous", "archives"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un projet…" className="pl-9" />
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{p.name}</CardTitle>
                  <p className="text-xs text-muted">{p.type} · {p.category || "—"}</p>
                </div>
                {p.role && p.role !== "owner" && <Badge tone="neutral">Collaboration</Badge>}
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted">{p.nDocuments} docs · Mis à jour {fmt(p.updatedAt)}</span>
                <Link href={`/projets/${p.id}`}>
                  <Button variant="secondary" size="sm">Ouvrir →</Button>
                </Link>
              </div>
            </Card>
          ))}
          <Link href="/projets/nouveau">
            <Card className="flex h-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-transparent text-center hover:border-soft-pink">
              <Plus className="h-6 w-6 text-soft-pink" />
              <p className="font-heading font-bold text-foreground">Nouveau projet</p>
              <p className="text-xs text-muted">Créer un nouveau dossier</p>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Page de création**

```tsx
// web/app/(app)/projets/nouveau/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, X, Mail } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const PROJECT_TYPES = ["Contentieux de plagiat", "Mandat d'agent", "Cession de droits", "Autre"];
type PendingInvite = { email: string; role: "co-admin" | "collaborateur" | "lecteur" };

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState(PROJECT_TYPES[0]);
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [confidential, setConfidential] = useState(true);
  const [notifyOnInvite, setNotifyOnInvite] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PendingInvite["role"]>("collaborateur");
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email.includes("@")) return;
    setInvites((prev) => [...prev, { email, role: inviteRole }]);
    setInviteEmail("");
  }

  async function createProject() {
    if (!name.trim()) {
      setError("Le nom du projet est requis.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, category, summary, confidential, notifyOnInvite, invitations: invites }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création du projet.");
        return;
      }
      const projectId = data.id as string;

      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        await fetch(`/api/projects/${projectId}/attachments`, { method: "POST", body: form }).catch(() => null);
      }

      router.push(`/projets/${projectId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title="Nouveau Projet"
        subtitle="Créez un nouveau dossier de projet — définissez son nom, son type, ajoutez des collaborateurs et joignez vos premiers documents."
        icon={<FolderPlus className="h-6 w-6" />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="space-y-4">
            <CardTitle>Informations générales</CardTitle>
            <div>
              <Label>Nom du projet *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Affaire Dupont / Éditions Maro" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Type de projet *</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm text-foreground"
                >
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Catégorie d&apos;œuvre</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. Roman · Littérature générale" />
              </div>
            </div>
            <div>
              <Label>Résumé du projet</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Décrivez brièvement ce projet, son contexte, les enjeux et les parties impliquées…" />
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>Pièces jointes</CardTitle>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-surface-2 px-4 py-6 text-center hover:border-soft-pink">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
              <p className="text-sm text-foreground">Glissez vos fichiers ici ou cliquez pour parcourir</p>
              <p className="text-xs text-muted">PDF, DOCX, TXT, MP3 · Max 20 Mo par fichier</p>
            </label>
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
                <span className="truncate text-foreground">{f.name}</span>
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-3">
            <CardTitle>Inviter un collaborateur</CardTitle>
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Entrer l'adresse e-mail…"
              onKeyDown={(e) => e.key === "Enter" && addInvite()}
            />
            <div className="flex flex-wrap gap-2">
              {(["co-admin", "collaborateur", "lecteur"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`rounded-full px-3 py-1 text-xs capitalize ${inviteRole === r ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button variant="purple" className="w-full" onClick={addInvite}>
              <Mail className="h-4 w-4" /> Envoyer l&apos;invitation
            </Button>
            <div className="space-y-2 pt-2">
              {invites.map((inv, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{inv.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{inv.role}</Badge>
                    <button onClick={() => setInvites((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <CardTitle>Options du projet</CardTitle>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Projet confidentiel<br /><span className="text-xs text-muted">Accès restreint aux collaborateurs invités</span></span>
              <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} className="h-5 w-9 accent-accent" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Notifier les collaborateurs<br /><span className="text-xs text-muted">Envoyer un email à l&apos;invitation</span></span>
              <input type="checkbox" checked={notifyOnInvite} onChange={(e) => setNotifyOnInvite(e.target.checked)} className="h-5 w-9 accent-accent" />
            </label>
          </Card>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button variant="primary" className="w-full" onClick={createProject} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Créer le projet
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx eslint "app/(app)/projets/page.tsx" "app/(app)/projets/nouveau/page.tsx"`
Expected: 0 erreur

- [ ] **Step 4 : Commit**

```bash
git add "app/(app)/projets/page.tsx" "app/(app)/projets/nouveau/page.tsx"
git commit -m "feat(projets): pages liste et création (fidèles au Figma)"
```

---

### Task P10 : Page `/projets/[id]` (détail)

**Files:**
- Create: `web/app/(app)/projets/[id]/page.tsx`

- [ ] **Step 1 : Page détail**

```tsx
// web/app/(app)/projets/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { FolderKanban, ScanText, GitCompareArrows, MessageSquare, Sparkles, Paperclip, Settings, Loader2 } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SessionItem { kind: "analysis" | "comparison" | "chat"; id: string; title: string; ownerId: string; createdAt: string }
interface ProjectDetail {
  id: string; name: string; type: string; category: string; createdAt: string; role: string;
  counts: { analyses: number; comparisons: number; chats: number };
  sessions: SessionItem[];
  members: { userId: string; role: string }[];
  lastSynthesis: { text: string; generatedAt: string | null } | null;
  attachments: { id: string; filename: string; url: string; size: number }[];
}

const fmtRelative = (d: string) => {
  const diffMs = Date.now() - new Date(d).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
};

const sessionHref = (s: SessionItem) =>
  s.kind === "analysis" ? `/historique/analyses/${s.id}` : s.kind === "comparison" ? `/historique/comparaisons/${s.id}` : `/chat?conversationId=${s.id}`;

const sessionIcon = (kind: SessionItem["kind"]) =>
  kind === "analysis" ? <ScanText className="h-4 w-4 text-soft-purple" /> : kind === "comparison" ? <GitCompareArrows className="h-4 w-4 text-soft-pink" /> : <MessageSquare className="h-4 w-4 text-yellow" />;

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<"projet" | "moi">("projet");
  const [synthLoading, setSynthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    if (res.ok) setProject(data);
    else setError(data.error ?? "Projet introuvable.");
  }

  useEffect(() => { load(); }, [id]);

  async function runSynthesis() {
    setSynthLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/synthesis`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setProject((p) => (p ? { ...p, lastSynthesis: { text: data.text, generatedAt: data.generatedAt } } : p));
      else setError(data.error ?? "Erreur lors de la synthèse.");
    } finally {
      setSynthLoading(false);
    }
  }

  if (error) return <Card className="mx-auto max-w-lg text-sm text-red-400">{error}</Card>;
  if (!project) return <p className="text-muted">Chargement…</p>;

  const canLaunch = project.role === "owner" || project.role === "co-admin" || project.role === "collaborateur";
  const canManage = project.role === "owner" || project.role === "co-admin";
  const sessions = tab === "moi" ? project.sessions.filter((s) => s.ownerId === project.members.find((m) => m.role === project.role)?.userId) : project.sessions;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GradientHeader
        title={project.name}
        subtitle={`${project.type} · ${project.category || "—"} · Créé le ${new Date(project.createdAt).toLocaleDateString("fr-FR")} · ${project.members.length} collaborateur(s)`}
        icon={<FolderKanban className="h-6 w-6" />}
        action={canManage && (
          <Link href={`/projets/${id}/membres`}>
            <Button variant="secondary"><Settings className="h-4 w-4" /> Gérer les collaborateurs</Button>
          </Link>
        )}
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-muted">Outils du projet</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <ToolCard icon={<ScanText className="h-5 w-5 text-soft-purple" />} count={project.counts.analyses} label="Analyse de texte" href={canLaunch ? `/analyser?projectId=${id}` : undefined} cta="Lancer" />
          <ToolCard icon={<GitCompareArrows className="h-5 w-5 text-soft-pink" />} count={project.counts.comparisons} label="Comparer deux textes" href={canLaunch ? `/comparer?projectId=${id}` : undefined} cta="Lancer" />
          <ToolCard icon={<MessageSquare className="h-5 w-5 text-yellow" />} count={project.counts.chats} label="NARR'IA Chat" href={`/chat?projectId=${id}`} cta="Ouvrir" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>Historique des sessions</CardTitle>
              <div className="flex gap-2">
                {(["projet", "moi"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs ${tab === t ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}>
                    {t === "projet" ? "Sessions du projet" : "Mes sessions"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sessions.length === 0 && <p className="py-4 text-sm text-muted">Aucune session pour le moment.</p>}
              {sessions.map((s) => (
                <div key={`${s.kind}-${s.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                  {sessionIcon(s.kind)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-xs text-muted">{fmtRelative(s.createdAt)}</p>
                  </div>
                  <Link href={sessionHref(s)}><Button variant="secondary" size="sm">Voir</Button></Link>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-soft-pink" /> Synthèse des rapports</CardTitle>
            {project.lastSynthesis?.text ? (
              <p className="whitespace-pre-line text-sm text-foreground/90">{project.lastSynthesis.text}</p>
            ) : (
              <p className="text-sm text-muted">Aucune synthèse générée pour le moment.</p>
            )}
            <Button variant="purple" className="w-full" onClick={runSynthesis} disabled={synthLoading}>
              {synthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {project.lastSynthesis?.text ? "Régénérer la synthèse" : "Générer la synthèse"}
            </Button>
          </Card>

          <Card className="space-y-2">
            <CardTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Pièces jointes</CardTitle>
            {project.attachments.length === 0 && <p className="text-sm text-muted">Aucune pièce jointe.</p>}
            {project.attachments.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block truncate rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground hover:border-soft-pink">
                {a.filename}
              </a>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ icon, count, label, href, cta }: { icon: React.ReactNode; count: number; label: string; href?: string; cta: string }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">{icon}</div>
        <Badge tone="neutral">{count} {count > 1 ? "sessions" : "session"}</Badge>
      </div>
      <CardTitle className="text-base">{label}</CardTitle>
      {href ? (
        <Link href={href}><Button variant="primary" size="sm" className="w-full">{cta}</Button></Link>
      ) : (
        <Button variant="secondary" size="sm" className="w-full" disabled>{cta}</Button>
      )}
    </Card>
  );
}
```

- [ ] **Step 2 : Vérifications**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx eslint "app/(app)/projets/[id]/page.tsx"`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add "app/(app)/projets/[id]/page.tsx"
git commit -m "feat(projets): page de détail (outils, historique, synthèse, pièces jointes)"
```

---

### Task P11 : Page `/projets/[id]/membres` (gestion des collaborateurs)

**Files:**
- Create: `web/app/(app)/projets/[id]/membres/page.tsx`

- [ ] **Step 1 : Page de gestion**

```tsx
// web/app/(app)/projets/[id]/membres/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Users, Mail, Copy, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProjectDetail {
  id: string; name: string; confidential: boolean; inviteLinkToken: string | null;
  members: { userId: string; role: string }[];
  pendingInvitations: { id: string; email: string; role: string }[];
}

export default function ProjectMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"co-admin" | "collaborateur" | "lecteur">("collaborateur");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    if (res.ok) setProject(data);
    else setError(data.error);
  }

  useEffect(() => { load(); }, [id]);

  async function invite() {
    setError(null);
    const res = await fetch(`/api/projects/${id}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setEmail("");
    load();
  }

  async function revoke(invitationId: string) {
    await fetch(`/api/projects/${id}/invitations/${invitationId}`, { method: "DELETE" });
    load();
  }

  async function changeRole(userId: string, newRole: string) {
    await fetch(`/api/projects/${id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  }

  async function removeMember(userId: string) {
    await fetch(`/api/projects/${id}/members/${userId}`, { method: "DELETE" });
    load();
  }

  async function regenerateLink() {
    await fetch(`/api/projects/${id}/invite-link`, { method: "POST" });
    load();
  }

  if (!project) return <p className="text-muted">Chargement…</p>;

  const inviteLinkUrl = project.inviteLinkToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/projets/rejoindre/${project.inviteLinkToken}` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <GradientHeader title="Gérer les collaborateurs" subtitle={project.name} icon={<Users className="h-6 w-6" />} />

      <Link href={`/projets/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au projet
      </Link>

      <Card className="space-y-3">
        <CardTitle>Inviter par e-mail</CardTitle>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Entrer l'adresse e-mail…" />
        <div className="flex gap-2">
          {(["co-admin", "collaborateur", "lecteur"] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} className={`rounded-full px-3 py-1 text-xs capitalize ${role === r ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}>
              {r}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button variant="purple" className="w-full" onClick={invite}><Mail className="h-4 w-4" /> Envoyer l&apos;invitation</Button>
      </Card>

      {project.pendingInvitations.length > 0 && (
        <Card className="space-y-2">
          <CardTitle>Invitations en attente</CardTitle>
          {project.pendingInvitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{inv.email}</span>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{inv.role}</Badge>
                <button onClick={() => revoke(inv.id)} className="text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>Membres</CardTitle>
        {project.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{m.userId}</span>
            {m.role === "owner" ? (
              <Badge tone="purple">owner</Badge>
            ) : (
              <div className="flex items-center gap-2">
                <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-foreground">
                  <option value="co-admin">co-admin</option>
                  <option value="collaborateur">collaborateur</option>
                  <option value="lecteur">lecteur</option>
                </select>
                <button onClick={() => removeMember(m.userId)} className="text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Lien d&apos;invitation</CardTitle>
        {project.confidential ? (
          <p className="text-sm text-muted">Désactivé — ce projet est confidentiel (invitations e-mail nominatives uniquement).</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input value={inviteLinkUrl ?? ""} readOnly />
              <Button variant="secondary" size="icon" onClick={() => inviteLinkUrl && navigator.clipboard.writeText(inviteLinkUrl)}><Copy className="h-4 w-4" /></Button>
            </div>
            <Button variant="secondary" onClick={regenerateLink}><RefreshCw className="h-4 w-4" /> Régénérer le lien</Button>
          </>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifications finales du projet complet**

Run: `cd /Users/oswaldfaust/Code/NARRIA-2.0.0/web && npx tsc --noEmit -p . && npx eslint "app/(app)/projets/[id]/membres/page.tsx" && npx vitest run && pnpm build`
Expected: 0 erreur, tous les tests passent, build complet réussi avec toutes les routes
`/projets`, `/projets/nouveau`, `/projets/[id]`, `/projets/[id]/membres`,
`/projets/rejoindre/[token]` et `/api/projects/**` listées.

- [ ] **Step 3 : Commit**

```bash
git add "app/(app)/projets/[id]/membres/page.tsx"
git commit -m "feat(projets): page de gestion des collaborateurs (invitations, rôles, lien)"
```

---

## Self-Review Notes

- **Couverture de la spec** : modèles + permissions (P1), projectId sur sessions
  existantes + notification (P2), acceptation d'invitation + email (P3), CRUD projet
  (P4), invitations/membres/lien (P5), pièces jointes Blob (P6), synthèse IA (P7),
  branchement projectId dans analyze/compare/chat (P8), pages liste/création (P9),
  détail (P10), gestion collaborateurs (P11) — toutes les sections de la spec sont
  couvertes.
- **Décision assumée** : la vérification de permission dans `/api/chat/conversations`
  (Step 3 de P8) est laissée au jugement de l'implémenteur car une conversation chat
  n'est pas un "lancement d'outil" au même titre qu'une analyse/comparaison — décision
  documentée explicitement dans l'étape, pas un oubli.
- **Cohérence des types** : `ProjectRole` défini dans `project-member.ts`, réexporté par
  `permissions.ts`, utilisé identiquement dans toutes les routes (P4-P8) et dans le test
  P1. `Project.attachments[].id` (uuid) utilisé de façon cohérente entre la route
  d'upload (P6) et la route de suppression (P6) et l'affichage (P10).
- **Hors scope confirmé** : transfert de propriété, notifications temps réel, édition
  collaborative simultanée — non traités, comme documenté dans la spec.
- **Décision assumée** : `POST /api/projects/[id]/synthesis` (P7) restreint l'accès à
  `canLaunchTools` plutôt qu'à `canView` prévu initialement à l'étape 1 de P7. Décision
  prise et validée lors de la revue qualité de P7 : un simple `lecteur` ne doit pas pouvoir
  déclencher un appel LLM facturé au projet. Le bouton "Générer la synthèse" est masqué
  côté UI pour ce rôle (P10), cohérent avec la restriction serveur.
- **Correctif post-implémentation (revue finale holistique)** : les pages `/analyser`,
  `/comparer` et `/chat` ne lisaient pas le paramètre `?projectId=` transmis par les liens
  de la page de détail projet (P10) — l'infrastructure serveur (P8) existait mais n'était
  jamais alimentée en pratique, donc aucune session lancée depuis un projet n'était
  effectivement rattachée à celui-ci. Corrigé en lisant `useSearchParams().get("projectId")`
  et en le transmettant dans le body de `POST /api/analyze`, `POST /api/compare` et
  `POST /api/chat/conversations`.
