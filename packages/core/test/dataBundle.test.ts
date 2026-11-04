import { describe, expect, it } from "vitest";
import { createDataBundle } from "../src/exercise/dataBundle";
import type { Exercise, Routine } from "../src/exercise/types";

const exercise = {
  _id: "squat",
  _rev: "1-abc",
  name: "Squat",
  created_at: "2026-01-01",
  updatedAt: 1,
  recording_angles: [],
  recording_points: [],
} as Exercise;

const routine = {
  _id: "day1",
  _rev: "2-def",
  name: "Day 1",
  exercises: ["squat"],
  time: 60,
  stats: { bodyParts: {}, muscleGroups: [] },
  created_at: "2026-01-01",
  updatedAt: 1,
} as unknown as Routine;

describe("createDataBundle", () => {
  it("drops _rev, keeps everything else and stamps the export time", () => {
    const now = new Date("2026-05-05T10:00:00.000Z");
    const bundle = createDataBundle([exercise], [routine], now);

    expect(bundle.kgm_bundle).toBe(1);
    expect(bundle.exported_at).toBe("2026-05-05T10:00:00.000Z");
    expect(bundle.exercises[0]).not.toHaveProperty("_rev");
    expect(bundle.routines[0]).not.toHaveProperty("_rev");
    expect(bundle.exercises[0]).toMatchObject({ _id: "squat", name: "Squat" });
    expect(bundle.routines[0]).toMatchObject({ _id: "day1", exercises: ["squat"] });
  });

  it("does not mutate its inputs", () => {
    createDataBundle([exercise], [routine]);
    expect(exercise._rev).toBe("1-abc");
    expect(routine._rev).toBe("2-def");
  });
});
