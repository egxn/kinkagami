import { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const {
  setBackendMock,
  readyMock,
  getBackendMock,
  createDetectorMock,
  disposeMock,
} = vi.hoisted(() => ({
  setBackendMock: vi.fn(),
  readyMock: vi.fn(),
  getBackendMock: vi.fn(),
  createDetectorMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock("@tensorflow/tfjs", () => ({
  setBackend: setBackendMock,
  ready: readyMock,
  getBackend: getBackendMock,
}));

vi.mock("@tensorflow-models/hand-pose-detection", () => ({
  SupportedModels: {
    MediaPipeHands: "MediaPipeHands",
  },
  createDetector: createDetectorMock,
}));

vi.mock("../hooks/useModelVersions", () => ({
  useModelVersions: () => ({
    config: {
      movenet: "lightning",
      blazepose: "lite",
      handpose: "full",
    },
  }),
}));

vi.mock("../utils/modelVersions", () => ({
  getHandPoseDetectorUrl: (version: string) =>
    `/models/handpose/detector/${version}/model.json`,
  getHandPoseLandmarkUrl: (version: string) =>
    `/models/handpose/landmark/${version}/model.json`,
}));

interface HandPoseState {
  detector: unknown;
  isLoading: boolean;
  error: string | null;
  status: string;
}

describe("useHandPose", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    setBackendMock.mockResolvedValue(undefined);
    readyMock.mockResolvedValue(undefined);
    getBackendMock.mockReturnValue("cpu");
    createDetectorMock.mockResolvedValue({
      estimateHands: vi.fn(async () => []),
      dispose: disposeMock,
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  async function renderProbe(onState: (state: HandPoseState) => void) {
    const { useHandPose } = await import("../hooks/useHandPose");

    function Probe() {
      const state = useHandPose();
      useEffect(() => {
        onState(state as HandPoseState);
      }, [state]);
      return <div>{state.status}</div>;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Probe />);
      await Promise.resolve();
    });
  }

  it("loads shared detector and reports success", async () => {
    let latest: HandPoseState | null = null;

    await renderProbe((state) => {
      latest = state;
    });

    expect(setBackendMock).toHaveBeenCalledWith("webgl");
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "/models/handpose/detector/full/model.json",
      { method: "HEAD" },
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "/models/handpose/landmark/full/model.json",
      { method: "HEAD" },
    );
    expect(createDetectorMock).toHaveBeenCalledWith("MediaPipeHands", {
      runtime: "tfjs",
      modelType: "full",
      detectorModelUrl: "/models/handpose/detector/full/model.json",
      landmarkModelUrl: "/models/handpose/landmark/full/model.json",
    });

    const state = latest as unknown as HandPoseState;
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.status).toContain("successfully");
  });

  it("normalizes dependency errors from detector init", async () => {
    createDetectorMock.mockRejectedValue(
      new Error("Cannot find module hand-pose-detection"),
    );

    let latest: HandPoseState | null = null;
    await renderProbe((state) => {
      latest = state;
    });

    const state = latest as unknown as HandPoseState;
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(
      "Missing dependency: install @tensorflow-models/hand-pose-detection and restart dev server.",
    );
    expect(state.status).toContain("Error:");
  });
});
