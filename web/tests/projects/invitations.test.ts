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
import { ProjectInvitation } from "@/lib/db/models/project-invitation";

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
    expect(memberDocs.filter((m) => m.projectId === "p3" && m.userId === "user3")).toHaveLength(1);
    expect(invitationDocs[0].status).toBe("accepted");
  });

  it("ne lève jamais d'exception si une opération DB échoue (best-effort)", async () => {
    vi.spyOn(ProjectInvitation, "find").mockRejectedValueOnce(new Error("DB indisponible"));
    await expect(acceptPendingInvitationsForEmail("userX", "x@test.fr")).resolves.toBeUndefined();
  });
});
