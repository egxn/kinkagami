import { act, useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { usePagedCarousel } from "../hooks/usePagedCarousel";

interface ProbeState {
  pageItems: number[];
  startIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
  transitionDirection: "forward" | "backward";
  goPrevious: () => void;
  goNext: () => void;
}

function Probe({
  items,
  itemsPerPage,
  onState,
}: {
  items: number[];
  itemsPerPage: number;
  onState: (state: ProbeState) => void;
}) {
  const state = usePagedCarousel(items, itemsPerPage);

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  return <div>{state.pageItems.join(",")}</div>;
}

describe("usePagedCarousel", () => {
  let container: HTMLDivElement;
  let root: Root;

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

  it("navigates pages forward and backward with flags", async () => {
    let latest: ProbeState | null = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          items={[1, 2, 3, 4, 5]}
          itemsPerPage={2}
          onState={(state) => {
            latest = state;
          }}
        />,
      );
    });

    let state = latest as unknown as ProbeState;
    expect(state.pageItems).toEqual([1, 2]);
    expect(state.startIndex).toBe(0);
    expect(state.hasPrevious).toBe(false);
    expect(state.hasNext).toBe(true);

    await act(async () => {
      state = latest as unknown as ProbeState;
      state.goNext();
    });

    state = latest as unknown as ProbeState;
    expect(state.pageItems).toEqual([3, 4]);
    expect(state.startIndex).toBe(2);
    expect(state.hasPrevious).toBe(true);
    expect(state.hasNext).toBe(true);
    expect(state.transitionDirection).toBe("forward");

    await act(async () => {
      state = latest as unknown as ProbeState;
      state.goPrevious();
    });

    state = latest as unknown as ProbeState;
    expect(state.pageItems).toEqual([1, 2]);
    expect(state.startIndex).toBe(0);
    expect(state.hasPrevious).toBe(false);
    expect(state.transitionDirection).toBe("backward");
  });

  it("clamps start index when list shrinks", async () => {
    let latest: ProbeState | null = null;
    let state: ProbeState;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          items={[1, 2, 3, 4, 5]}
          itemsPerPage={2}
          onState={(state) => {
            latest = state;
          }}
        />,
      );
    });

    await act(async () => {
      state = latest as unknown as ProbeState;
      state.goNext();
      state.goNext();
    });

    state = latest as unknown as ProbeState;
    expect(state.startIndex).toBe(3);
    expect(state.pageItems).toEqual([4, 5]);

    await act(async () => {
      root.render(
        <Probe
          items={[10, 11, 12]}
          itemsPerPage={2}
          onState={(state) => {
            latest = state;
          }}
        />,
      );
    });

    state = latest as unknown as ProbeState;
    expect(state.startIndex).toBe(1);
    expect(state.pageItems).toEqual([11, 12]);
    expect(state.hasNext).toBe(false);
  });
});
