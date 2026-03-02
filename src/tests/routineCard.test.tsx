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

import RoutineCard from "../components/RoutineCard";

describe("RoutineCard", () => {
  it("renders routine info and computed count", () => {
    const html = renderToStaticMarkup(
      <RoutineCard
        routine={{
          name: "Rutina A",
          description: "Desc",
          exercises: ["e1", "e2"],
          time: 90,
          stats: { bodyParts: { nose: 0, ear: 0, shoulder: 0, elbow: 0, wrist: 0, hip: 0, knee: 0, ankle: 0 }, muscleGroups: ["core"] },
          created_at: new Date().toISOString(),
          updatedAt: Date.now(),
        }}
      />,
    );

    expect(html).toContain("Rutina A");
    expect(html).toContain("Desc");
    expect(html).toContain("2 ejercicios");
    expect(html).toContain("90s");
  });

  it("uses fallbacks for missing name and description", () => {
    const html = renderToStaticMarkup(
      <RoutineCard
        routine={{
          name: "",
          description: "",
          exercises: [],
          time: 0,
          stats: { bodyParts: { nose: 0, ear: 0, shoulder: 0, elbow: 0, wrist: 0, hip: 0, knee: 0, ankle: 0 }, muscleGroups: [] },
          created_at: new Date().toISOString(),
          updatedAt: Date.now(),
        }}
      />,
    );

    expect(html).toContain("Sin nombre");
    expect(html).toContain("Sin descripción");
  });
});
