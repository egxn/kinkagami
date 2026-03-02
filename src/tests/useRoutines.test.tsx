import React, { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useRoutines } from "../hooks/useRoutines";
import type { Routine } from "../types/exercise";
import * as dbService from "../db/dbService";

vi.mock("../utils/logger", () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

const changesHandlers: Record<string, ((...args: unknown[]) => void) | undefined> = {};

const changesFeed = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    changesHandlers[event] = handler;
    return changesFeed;
  }),
  cancel: vi.fn(),
};

vi.mock("../db/dbService", () => ({
  getAllRoutines: vi.fn(),
  addRoutine: vi.fn(),
  updateRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
  clearRoutinesDatabase: vi.fn(),
  routinesDB: {
    changes: vi.fn(() => changesFeed),
  },
}));

interface RoutinesState {
  routines: Routine[];
  loading: boolean;
  error: Error | null;
  addNewRoutine: (routine: Omit<Routine, "_id" | "_rev" | "updatedAt">) => Promise<void>;
  updateRoutineData: (id: string, updates: Partial<Routine>) => Promise<void>;
  deleteRoutineData: (id: string) => Promise<void>;
  clearAllRoutinesData: () => Promise<number>;
  refreshRoutines: () => Promise<void>;
}

function Probe({ onState }: { onState: (state: RoutinesState) => void }) {
  const state = useRoutines();

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  return <div>{state.loading ? "loading" : state.routines.length}</div>;
}

const makeRoutine = (
  id: string,
  createdAt: string,
  updatedAt: number,
): Routine => ({
  _id: id,
  name: id,
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
  created_at: createdAt,
  updatedAt,
});

describe("useRoutines", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    changesHandlers.change = undefined;
    changesHandlers.error = undefined;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("loads routines and sorts newest first", async () => {
    const getAllRoutinesMock = vi.mocked(dbService.getAllRoutines);
    getAllRoutinesMock.mockResolvedValue([
      makeRoutine("old", "2024-01-01T00:00:00.000Z", 10),
      makeRoutine("new", "2024-01-02T00:00:00.000Z", 20),
      makeRoutine("legacy", "invalid-date", 15),
    ]);

    let latest: RoutinesState | null = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          onState={(state) => {
            latest = state;
          }}
        />,
      );
      await Promise.resolve();
    });

    expect(getAllRoutinesMock).toHaveBeenCalledTimes(1);
    expect(latest?.loading).toBe(false);
    expect(latest?.error).toBeNull();
    expect(latest?.routines.map((routine) => routine._id)).toEqual([
      "new",
      "old",
      "legacy",
    ]);
  });

  it("refreshes when routines DB emits change event", async () => {
    const getAllRoutinesMock = vi.mocked(dbService.getAllRoutines);
    getAllRoutinesMock.mockResolvedValue([
      makeRoutine("one", "2024-01-01T00:00:00.000Z", 10),
    ]);

    let latest: RoutinesState | null = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          onState={(state) => {
            latest = state;
          }}
        />,
      );
      await Promise.resolve();
    });

    expect(getAllRoutinesMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      changesHandlers.change?.();
      await Promise.resolve();
    });

    expect(getAllRoutinesMock).toHaveBeenCalledTimes(2);
    expect(latest?.routines).toHaveLength(1);
  });

  it("sets error and rethrows when delete operation fails", async () => {
    vi.mocked(dbService.getAllRoutines).mockResolvedValue([]);
    vi.mocked(dbService.deleteRoutine).mockRejectedValue(new Error("delete failed"));

    let latest: RoutinesState | null = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          onState={(state) => {
            latest = state;
          }}
        />,
      );
      await Promise.resolve();
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await latest?.deleteRoutineData("r1");
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("delete failed");
    expect(latest?.error?.message).toBe("delete failed");
  });
});
