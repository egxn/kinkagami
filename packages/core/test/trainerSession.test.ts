import { describe, expect, it } from "vitest";
import {
  SCORE_RELEASE_THRESHOLD,
  SCORE_THRESHOLD,
  createTrainerSession,
  getTargetReps,
  resolveRoutineItems,
  stepTrainerSession,
} from "../src/trainer/trainerSession";

const ITEMS = [
  { exerciseId: "a", reps: 2 },
  { exerciseId: "b", reps: 1 },
];
const RUN = { canComplete: true };

describe("trainerSession", () => {
  it("resolves items, falling back to the legacy exercise id list", () => {
    expect(resolveRoutineItems(null)).toEqual([]);
    expect(resolveRoutineItems({ exercises: ["x", "y"] })).toEqual([
      { exerciseId: "x", reps: 1 },
      { exerciseId: "y", reps: 1 },
    ]);
    expect(resolveRoutineItems({ exercises: ["x"], items: ITEMS })).toBe(ITEMS);
    expect(getTargetReps(undefined)).toBe(1);
    expect(getTargetReps({ exerciseId: "a", reps: 0 })).toBe(1);
  });

  it("does nothing below the threshold or when completion is disabled", () => {
    const s = createTrainerSession();
    expect(stepTrainerSession(s, SCORE_THRESHOLD - 1, ITEMS, RUN).state).toBe(
      s,
    );
    const off = stepTrainerSession(s, 100, ITEMS, { canComplete: false });
    expect(off.state).toBe(s);
    expect(off.event.type).toBe("none");
  });

  it("walks reps -> next exercise -> routine completed", () => {
    let s = createTrainerSession();

    let step = stepTrainerSession(s, 90, ITEMS, RUN);
    expect(step.event).toEqual({ type: "rep_completed", repCount: 1 });
    s = step.state;

    // Locked until the score is released, even if it stays high.
    expect(stepTrainerSession(s, 95, ITEMS, RUN).event.type).toBe("none");
    s = stepTrainerSession(s, SCORE_RELEASE_THRESHOLD, ITEMS, RUN).state;
    expect(s.repLocked).toBe(false);

    step = stepTrainerSession(s, 90, ITEMS, RUN);
    expect(step.event).toEqual({
      type: "exercise_completed",
      nextExerciseIndex: 1,
    });
    s = stepTrainerSession(step.state, 0, ITEMS, RUN).state;
    expect(s.exerciseIndex).toBe(1);
    expect(s.repCount).toBe(0);

    step = stepTrainerSession(s, 90, ITEMS, RUN);
    expect(step.event.type).toBe("routine_completed");
    expect(step.state.routineCompleted).toBe(true);

    // Nothing more can complete once the routine is done.
    const released = stepTrainerSession(step.state, 0, ITEMS, RUN).state;
    expect(stepTrainerSession(released, 100, ITEMS, RUN).event.type).toBe(
      "none",
    );
  });

  it("keeps the lock between the release and completion thresholds", () => {
    let s = stepTrainerSession(createTrainerSession(), 90, ITEMS, RUN).state;
    s = stepTrainerSession(s, 75, ITEMS, RUN).state;
    expect(s.repLocked).toBe(true);
  });

  it("ignores scores for an empty routine", () => {
    const s = createTrainerSession();
    expect(stepTrainerSession(s, 100, [], RUN).event.type).toBe("none");
  });
});
