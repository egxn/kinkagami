import { act, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useAvailableVideos } from "../hooks/useAvailableVideos";

interface VideoState {
  videos: { name: string; path: string }[];
  loading: boolean;
  error: string | null;
}

function Probe({ onState }: { onState: (state: VideoState) => void }) {
  const state = useAvailableVideos();

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  return <div>{state.loading ? "loading" : state.videos.length}</div>;
}

describe("useAvailableVideos", () => {
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

  it("loads videos from API when response is ok", async () => {
    const videos = [{ name: "a.mp4", path: "/videos/a.mp4" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => videos,
    } as Response);

    let latest: VideoState | null = null;
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

    const state = latest as unknown as VideoState;
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/videos");
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.videos).toEqual(videos);
  });

  it("returns empty list without error on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => [],
    } as Response);

    let latest: VideoState | null = null;
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

    const state = latest as unknown as VideoState;
    expect(state.loading).toBe(false);
    expect(state.videos).toEqual([]);
    expect(state.error).toBeNull();
  });

  it("fails silently and keeps empty list on network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    let latest: VideoState | null = null;
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

    const state = latest as unknown as VideoState;
    expect(state.loading).toBe(false);
    expect(state.videos).toEqual([]);
    expect(state.error).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
