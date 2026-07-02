import { describe, it, expect } from "vitest";
import { buildSequentialEdges } from "@/lib/engine/extraction/llm-extractor";
import type { NarrativeNode } from "@/lib/engine/models";

function node(id: string): NarrativeNode {
  return {
    nodeId: id, segmentId: `seg_${id}`, functionCode: "F01", functionFamily: "Rupture initiale",
    functionName: "Départ", actants: [], modalities: { vouloir: 0.5, devoir: 0.5, pouvoir: 0.5, savoir: 0.5 },
    tension: 0.2, phase: "Exposition", textExcerpt: "…",
  };
}

describe("buildSequentialEdges", () => {
  it("crée n-1 arêtes séquentielles reliant les nœuds consécutifs", () => {
    const nodes = [node("n001"), node("n002"), node("n003")];
    const edges = buildSequentialEdges(nodes);
    expect(edges).toHaveLength(2);
    expect(edges[0].source).toBe("n001");
    expect(edges[0].target).toBe("n002");
    expect(edges[1].source).toBe("n002");
    expect(edges[1].target).toBe("n003");
    expect(edges.every((e) => e.transitionType === "sequential")).toBe(true);
  });

  it("retourne aucune arête pour 0 ou 1 nœud", () => {
    expect(buildSequentialEdges([])).toHaveLength(0);
    expect(buildSequentialEdges([node("n001")])).toHaveLength(0);
  });
});
