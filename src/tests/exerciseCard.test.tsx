import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../components/Button", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-mock="button">{children}</div>
  ),
}));

vi.mock("../context/usePoseContext", () => ({
  default: () => ({ videoRef: { current: null }, streamReady: true }),
}));

import ExerciseCard from "../components/ExerciseCard";

describe("ExerciseCard", () => {
  it("renders selected badge and metadata", () => {
    const html = renderToStaticMarkup(
      <ExerciseCard
        exercise={{
          name: "Sentadilla",
          description: "Desc",
          difficulty: "beginner",
          duration: 30,
          reps: 12,
          sets: 3,
          muscle_groups: ["legs", "core"],
          recording_angles: [],
          recording_points: [],
          created_at: new Date().toISOString(),
          updatedAt: Date.now(),
        }}
        isSelected
        onClick={() => {}}
      />,
    );

    expect(html).toContain("✅");
    expect(html).toContain("Sentadilla");
    expect(html).toContain("Desc");
    expect(html).toContain("30s");
    expect(html).toContain("3x12");
    expect(html).toContain("legs");
  });

  it("renders name/description fallback", () => {
    const html = renderToStaticMarkup(
      <ExerciseCard
        exercise={{
          name: "",
          description: "",
          recording_angles: [],
          recording_points: [],
          created_at: new Date().toISOString(),
          updatedAt: Date.now(),
        }}
        isSelected={false}
        onClick={() => {}}
      />,
    );

    expect(html).toContain("Sin nombre");
    expect(html).toContain("Sin descripción");
  });
});
