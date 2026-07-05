import { describe, it, expect } from "vitest";
import { estimateTargetNodeCount } from "@/lib/engine/extraction/llm-extractor";

describe("estimateTargetNodeCount", () => {
  it("vise ~1 nœud par 400 mots, avec un plancher de 5", () => {
    expect(estimateTargetNodeCount(50)).toBe(5);
    expect(estimateTargetNodeCount(400)).toBe(5);
  });

  it("plafonne à 35 nœuds pour les textes très longs", () => {
    expect(estimateTargetNodeCount(50000)).toBe(35);
  });

  it("scale proportionnellement entre le plancher et le plafond", () => {
    const target = estimateTargetNodeCount(4000);
    expect(target).toBeGreaterThanOrEqual(9);
    expect(target).toBeLessThanOrEqual(11);
  });
});
