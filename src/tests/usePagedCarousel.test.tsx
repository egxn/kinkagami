import React, { act, useEffect } from "react";
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

    expect(latest?.pageItems).toEqual([1, 2]);
    expect(latest?.startIndex).toBe(0);
    expect(latest?.hasPrevious).toBe(false);
    expect(latest?.hasNext).toBe(true);

    await act(async () => {
      latest?.goNext();
    });

    expect(latest?.pageItems).toEqual([3, 4]);
    expect(latest?.startIndex).toBe(2);
    expect(latest?.hasPrevious).toBe(true);
    expect(latest?.hasNext).toBe(true);
    expect(latest?.transitionDirection).toBe("forward");

    await act(async () => {
      latest?.goPrevious();
    });

    expect(latest?.pageItems).toEqual([1, 2]);
    expect(latest?.startIndex).toBe(0);
    expect(latest?.hasPrevious).toBe(false);
    expect(latest?.transitionDirection).toBe("backward");
  });

  it("clamps start index when list shrinks", async () => {
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

    await act(async () => {
      latest?.goNext();
      latest?.goNext();
    });

    expect(latest?.startIndex).toBe(3);
    expect(latest?.pageItems).toEqual([4, 5]);

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

    expect(latest?.startIndex).toBe(1);
    expect(latest?.pageItems).toEqual([11, 12]);
    expect(latest?.hasNext).toBe(false);
  });
});
