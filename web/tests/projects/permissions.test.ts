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
