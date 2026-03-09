import { act, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useCamera } from "../hooks/useCamera";

interface CameraState {
  stream: MediaStream | null;
  isReady: boolean;
  error: string | null;
  onStreamReady: (() => void) | null;
  streamReady: boolean;
}

function Probe({ onState }: { onState: (state: CameraState) => void }) {
  const state = useCamera();

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  return <div>{state.isReady ? "ready" : "pending"}</div>;
}

describe("useCamera", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("gets camera stream and marks ready", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    const getUserMedia = vi.fn(async () => stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    let latest: CameraState | null = null;
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

    const state = latest as unknown as CameraState;
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(state.isReady).toBe(true);
    expect(state.streamReady).toBe(true);
    expect(state.error).toBeNull();
    expect(state.stream).toBe(stream);
    expect(typeof state.onStreamReady).toBe("function");

    await act(async () => {
      root.unmount();
    });

    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it("sets error when camera access fails", async () => {
    const getUserMedia = vi.fn(async () => {
      throw new Error("permission denied");
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    let latest: CameraState | null = null;
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

    const state = latest as unknown as CameraState;
    expect(state.isReady).toBe(false);
    expect(state.streamReady).toBe(false);
    expect(state.error).toContain("permission denied");
  });
});
