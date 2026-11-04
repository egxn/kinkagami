import { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const {
  createDetectorMock,
  disposeMock,
} = vi.hoisted(() => ({
  createDetectorMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock("@tensorflow-models/pose-detection", () => ({
  SupportedModels: { BlazePose: "BlazePose" },
  createDetector: createDetectorMock,
}));

vi.mock("../hooks/useModelVersions", () => ({
  useModelVersions: () => ({
    config: {
      movenet: "lightning",
      blazepose: "full",
      handpose: "lite",
    },
  }),
}));

vi.mock("../utils/modelVersions", () => ({
  getBlazePoseDetectorUrl: () => "/models/blazepose/detector/model.json",
  getBlazePoseLandmarkUrl: (version: string) =>
    `/models/blazepose/landmark/${version}/model.json`,
}));

import { useBlazePose } from "../inference";

interface BlazePoseState {
  detector: unknown;
  isLoading: boolean;
  error: string | null;
  status: string;
}

function Probe({ onState }: { onState: (state: BlazePoseState) => void }) {
  const state = useBlazePose();

  useEffect(() => {
    onState(state as BlazePoseState);
  }, [state, onState]);

  return <div>{state.status}</div>;
}

describe("useBlazePose", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    createDetectorMock.mockResolvedValue({
      dispose: disposeMock,
    });
  });

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

  it("loads blazepose using local mediapipe assets", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    let latest: BlazePoseState | null = null;

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

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "/models/blazepose/mediapipe/pose_solution_wasm_bin.wasm",
      { method: "HEAD" },
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "/models/blazepose/mediapipe/pose_web.binarypb",
      { method: "HEAD" },
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      "/models/blazepose/mediapipe/pose_landmark_full.tflite",
      { method: "HEAD" },
    );
    expect(createDetectorMock).toHaveBeenCalledWith("BlazePose", {
      runtime: "mediapipe",
      modelType: "full",
      solutionPath: "/models/blazepose/mediapipe",
      enableSmoothing: true,
    });

    const state = latest as unknown as BlazePoseState;
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.status).toContain("successfully");

    await act(async () => {
      root.unmount();
    });
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces error when mediapipe assets are missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);

    let latest: BlazePoseState | null = null;

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

    const state = latest as unknown as BlazePoseState;
    expect(state.isLoading).toBe(false);
    expect(state.error).toContain("Missing BlazePose MediaPipe asset");
    expect(state.status).toContain("Error:");
    expect(createDetectorMock).not.toHaveBeenCalled();
  });
});
