import { describe, expect, it } from "vitest";
import {
  createCompletion,
  createEdges,
  createSignals,
  createSyncNodes,
  generateEventGraph,
} from "../services/exerciseGenerator";
import type { EventEdge, EventNode, RecordingAngle } from "../types/exercise";

const recordingAngles: RecordingAngle[] = [
  {
    timestamp: 0,
    angles: [
      { name: "left_elbow_angle", points: ["left_shoulder", "left_elbow", "left_wrist"], value: 40 },
      { name: "right_elbow_angle", points: ["right_shoulder", "right_elbow", "right_wrist"], value: 50 },
    ],
  },
  {
    timestamp: 0.5,
    angles: [
      { name: "left_elbow_angle", points: ["left_shoulder", "left_elbow", "left_wrist"], value: 120 },
      { name: "right_elbow_angle", points: ["right_shoulder", "right_elbow", "right_wrist"], value: 130 },
    ],
  },
  {
    timestamp: 1,
    angles: [
      { name: "left_elbow_angle", points: ["left_shoulder", "left_elbow", "left_wrist"], value: 60 },
      { name: "right_elbow_angle", points: ["right_shoulder", "right_elbow", "right_wrist"], value: 70 },
    ],
  },
];

describe("exerciseGenerator", () => {
  it("createSignals keeps angles with significant movement", () => {
    const signals = createSignals(recordingAngles);
    expect(Object.keys(signals)).toContain("left_elbow_angle");
    expect(Object.keys(signals)).toContain("right_elbow_angle");
  });

  it("createSyncNodes builds sync when node ends coincide across signals", () => {
    const nodes = [
      {
        node: { id: "n1", signal: "s1", emit: true },
        startTimestamp: 0,
        endTimestamp: 1,
        durationMs: 1000,
      },
      {
        node: { id: "n2", signal: "s2", emit: true },
        startTimestamp: 0,
        endTimestamp: 1,
        durationMs: 1000,
      },
    ] as Array<{
      node: EventNode;
      startTimestamp: number;
      endTimestamp: number;
      durationMs: number;
    }>;

    const sync = createSyncNodes(nodes, 100);
    expect(sync.length).toBe(1);
    expect(sync[0].type).toBe("sync");
    expect(sync[0].requires).toEqual(["n1", "n2"]);
  });

  it("createCompletion returns empty terminal nodes for empty graph", () => {
    const completion = createCompletion([], [] as EventEdge[]);
    expect(completion.terminal_nodes).toEqual([]);
  });

  it("generateEventGraph returns coherent structure", () => {
    const out = generateEventGraph(recordingAngles);
    expect(Object.keys(out.signals).length).toBeGreaterThan(0);
    expect(Array.isArray(out.eventGraph.nodes)).toBe(true);
    expect(Array.isArray(out.eventGraph.edges)).toBe(true);
    expect(Array.isArray(out.completion.terminal_nodes)).toBe(true);
  });

  it("createSignals excludes angles below movement threshold (range < 8°)", () => {
    const flatAngles: RecordingAngle[] = [
      {
        timestamp: 0,
        angles: [{ name: "flat_angle", points: ["left_shoulder", "left_elbow", "left_wrist"], value: 90 }],
      },
      {
        timestamp: 1,
        angles: [{ name: "flat_angle", points: ["left_shoulder", "left_elbow", "left_wrist"], value: 93 }],
      },
    ];
    const signals = createSignals(flatAngles);
    expect(Object.keys(signals)).not.toContain("flat_angle");
  });

  it("createEdges creates sequential edge between consecutive nodes of same signal", () => {
    const nodesWithTiming = [
      { node: { id: "n1", signal: "s1", emit: true }, startTimestamp: 0, endTimestamp: 0.5, durationMs: 500 },
      { node: { id: "n2", signal: "s1", emit: true }, startTimestamp: 0.5, endTimestamp: 1, durationMs: 500 },
    ];
    const edges = createEdges(nodesWithTiming as any[], []);
    expect(edges).toContainEqual({ from: "n1", to: "n2" });
  });

  it("createCompletion identifies terminal node (node with no outgoing edges)", () => {
    const nodesWithTiming = [
      { node: { id: "n1", emit: true }, startTimestamp: 0, endTimestamp: 0.5, durationMs: 500 },
      { node: { id: "n2", emit: true }, startTimestamp: 0.5, endTimestamp: 1, durationMs: 500 },
    ];
    const edges: EventEdge[] = [{ from: "n1", to: "n2" }];
    const completion = createCompletion(nodesWithTiming as any[], edges);
    expect(completion.terminal_nodes).toEqual(["n2"]);
  });
});
