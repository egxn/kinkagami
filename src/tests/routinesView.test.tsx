import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../hooks", () => ({
  usePagedCarousel: () => ({
    pageItems: [
      {
        _id: "r1",
        name: "Rutina 1",
        description: "Desc 1",
        exercises: ["e1"],
        items: [{ exerciseId: "e1", reps: 1 }],
        time: 30,
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
          muscleGroups: ["core"],
        },
        created_at: new Date().toISOString(),
        updatedAt: Date.now(),
      },
      null,
    ],
    startIndex: 0,
    hasPrevious: false,
    hasNext: false,
    transitionDirection: "forward" as const,
    goPrevious: vi.fn(),
    goNext: vi.fn(),
  }),
}));

vi.mock("../hooks/useRoutines", () => ({
  useRoutines: () => ({
    routines: [],
    loading: false,
    error: null,
    refreshRoutines: vi.fn(async () => {}),
    deleteRoutineData: vi.fn(async () => {}),
    clearAllRoutinesData: vi.fn(async () => 0),
  }),
}));

vi.mock("../context/useRoutine", () => ({
  useRoutine: () => ({
    selectedRoutine: null,
    setSelectedRoutine: vi.fn(),
  }),
}));

vi.mock("../context/usePoseContext", () => ({
  default: () => ({ videoRef: { current: null }, streamReady: true }),
}));

vi.mock("../components/Button", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-mock="button">{children}</div>
  ),
}));

import { RoutinesView } from "../views/Routines";

describe("RoutinesView", () => {
  it("renders routine card and action slot button", () => {
    const html = renderToStaticMarkup(
      <RoutinesView
        routines={[]}
        loading={false}
        error={null}
        onDiscardRoutine={async () => {}}
      />,
    );

    expect(html).toContain("Rutina 1");
    expect(html).toContain("Eliminar");
    expect(html).toContain("Nueva rutina");
  });

  it("renders loading state via CardLayout", () => {
    const html = renderToStaticMarkup(
      <RoutinesView routines={[]} loading error={null} />,
    );

    expect(html).toContain("Cargando rutinas...");
  });
});
