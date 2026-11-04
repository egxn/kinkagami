import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../context/usePoseContext", () => ({
  default: () => ({ videoRef: { current: null }, streamReady: true }),
}));

vi.mock("../hooks", async () => {
  const actual = await vi.importActual<object>("../hooks");
  return {
    ...actual,
    usePagedCarousel: () => ({
      pageItems: [],
      startIndex: 0,
      hasPrevious: false,
      hasNext: false,
      transitionDirection: "forward" as const,
      goPrevious: vi.fn(),
      goNext: vi.fn(),
    }),
  };
});

vi.mock("../db/dbService", () => ({
  getAllExercises: vi.fn(async () => []),
  addRoutine: vi.fn(async () => ({ success: true })),
  calculateRoutineStats: vi.fn(() => ({
    stats: {
      bodyParts: {
        nose: 0,
        ear: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        hip: 0,
        knee: 0,
        ankle: 0,
      },
      muscleGroups: [],
    },
    totalTime: 0,
  })),
  getExerciseById: vi.fn(async () => null),
}));

vi.mock("../components/Button", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-mock="button">{children}</div>
  ),
}));

import Exercises from "../views/Exercises";

describe("Exercises view", () => {
  it("renders loading state on first render", () => {
    const html = renderToStaticMarkup(<Exercises />);
    expect(html).toContain("Cargando ejercicios...");
  });

  it("renders footer action label", () => {
    const html = renderToStaticMarkup(<Exercises />);
    expect(html).toContain("Crear Rutina (0)");
  });
});
