import { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const {
  setBackendMock,
  readyMock,
  getBackendMock,
  zerosMock,
  createDetectorMock,
  disposeMock,
  estimatePosesMock,
} = vi.hoisted(() => ({
  setBackendMock: vi.fn(),
  readyMock: vi.fn(),
  getBackendMock: vi.fn(),
  zerosMock: vi.fn(),
  createDetectorMock: vi.fn(),
  disposeMock: vi.fn(),
  estimatePosesMock: vi.fn(),
}));

vi.mock("@tensorflow/tfjs", () => ({
  setBackend: setBackendMock,
  ready: readyMock,
  getBackend: getBackendMock,
  zeros: zerosMock,
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

import { useBlazePose } from "../hooks/useBlazePose";

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
    setBackendMock.mockResolvedValue(undefined);
    readyMock.mockResolvedValue(undefined);
    getBackendMock.mockReturnValue("webgl");

    const warmTensor = { dispose: vi.fn() };
    zerosMock.mockReturnValue(warmTensor);

    estimatePosesMock.mockResolvedValue([]);
    createDetectorMock.mockResolvedValue({
      estimatePoses: estimatePosesMock,
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

  it("loads blazepose and performs warmup inference", async () => {
    vi.spyOn(globalThis, "fetch")
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

    expect(setBackendMock).toHaveBeenCalledWith("webgl");
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "/models/blazepose/detector/model.json",
      { method: "HEAD" },
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "/models/blazepose/landmark/full/model.json",
      { method: "HEAD" },
    );
    expect(createDetectorMock).toHaveBeenCalledWith("BlazePose", {
      runtime: "tfjs",
      modelType: "full",
      detectorModelUrl: "/models/blazepose/detector/model.json",
      landmarkModelUrl: "/models/blazepose/landmark/full/model.json",
      enableSmoothing: true,
    });
    expect(zerosMock).toHaveBeenCalledWith([1, 1, 3]);
    expect(estimatePosesMock).toHaveBeenCalled();

    const state = latest as unknown as BlazePoseState;
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.status).toContain("successfully");

    await act(async () => {
      root.unmount();
    });
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces error when detector model file is missing", async () => {
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
    expect(state.error).toContain("Missing BlazePose detector model");
    expect(state.status).toContain("Error:");
    expect(createDetectorMock).not.toHaveBeenCalled();
  });
});
