import { describe, expect, it } from "vitest";
import { createDataBundle, type Exercise, type Routine } from "@kgm/core";
import { classifyDocuments } from "./importJson";

const exercise = {
  exercise_id: "squat",
  signals: {},
  event_graph: { nodes: [], edges: [] },
};
const routine = {
  name: "Day 1",
  exercises: ["squat"],
  items: [{ exerciseId: "squat", reps: 2 }],
};

describe("classifyDocuments", () => {
  it("classifies single documents", () => {
    expect(classifyDocuments(exercise).exercises).toHaveLength(1);
    expect(classifyDocuments(routine).routines).toHaveLength(1);
  });

  it("handles arrays and skips unknown values", () => {
    const out = classifyDocuments([exercise, routine, { foo: 1 }, 5]);
    expect(out.exercises).toHaveLength(1);
    expect(out.routines).toHaveLength(1);
    expect(out.skipped).toBe(2);
  });

  it("unpacks bundles, telling them apart from a routine's id list", () => {
    const out = classifyDocuments({
      exercises: [exercise],
      routines: [routine],
    });
    expect(out.exercises).toHaveLength(1);
    expect(out.routines).toHaveLength(1);
  });

  it("imports bundles produced by createDataBundle (embedded export contract)", () => {
    const bundle = createDataBundle(
      [exercise as unknown as Exercise],
      [routine as unknown as Routine],
    );
    const out = classifyDocuments(JSON.parse(JSON.stringify(bundle)));
    expect(out.exercises).toHaveLength(1);
    expect(out.routines).toHaveLength(1);
    expect(out.skipped).toBe(0);
  });
});
