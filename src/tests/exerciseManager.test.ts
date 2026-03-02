import { describe, expect, it } from "vitest";
import { validateExercise } from "../services/exerciseManager";
import type { Exercise } from "../types/exercise";

const baseExercise = (): Exercise => ({
  created_at: new Date().toISOString(),
  updatedAt: Date.now(),
  recording_angles: [],
  recording_points: [],
});

describe("exerciseManager.validateExercise", () => {
  it("returns valid for minimal exercise", () => {
    const out = validateExercise(baseExercise());
    expect(out.valid).toBe(true);
    expect(out.errors).toEqual([]);
  });

  it("fails when created_at is missing", () => {
    const ex = baseExercise();
    ex.created_at = "";

    const out = validateExercise(ex);
    expect(out.valid).toBe(false);
    expect(out.errors).toContain("Missing created_at");
  });

  it("validates grid_validation structure", () => {
    const ex = baseExercise();
    ex.grid_validation = {
      version: 1,
      rows: 1,
      cols: 1,
      keypoints: [] as never,
      min_confidence: 0.3,
      source_frame_count: 0,
      cell_sequence_by_keypoint: null as unknown as Record<string, number[]>,
      total_transitions_by_keypoint: null as unknown as Record<string, number>,
    };

    const out = validateExercise(ex);
    expect(out.valid).toBe(false);
    expect(out.errors).toContain("grid_validation.rows must be a number >= 2");
    expect(out.errors).toContain("grid_validation.cols must be a number >= 2");
    expect(out.errors).toContain("grid_validation.cell_sequence_by_keypoint must be an object");
    expect(out.errors).toContain("grid_validation.total_transitions_by_keypoint must be an object");
  });
});
