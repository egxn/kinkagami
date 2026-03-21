import { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const {
  setBackendMock,
  readyMock,
  getBackendMock,
  disposeMock,
  createDetectorMock,
} = vi.hoisted(() => ({
  setBackendMock: vi.fn(),
  readyMock: vi.fn(),
  getBackendMock: vi.fn(),
  disposeMock: vi.fn(),
  createDetectorMock: vi.fn(),
}));

vi.mock("@tensorflow/tfjs", () => ({
  setBackend: setBackendMock,
  ready: readyMock,
  getBackend: getBackendMock,
}));

vi.mock("@tensorflow-models/pose-detection", () => ({
  SupportedModels: { MoveNet: "MoveNet" },
  movenet: {
    modelType: {
      SINGLEPOSE_THUNDER: "SINGLEPOSE_THUNDER",
      SINGLEPOSE_LIGHTNING: "SINGLEPOSE_LIGHTNING",
    },
  },
  createDetector: createDetectorMock,
}));

vi.mock("../hooks/useModelVersions", () => ({
  useModelVersions: () => ({
    config: {
      movenet: "thunder",
      blazepose: "lite",
      handpose: "lite",
    },
  }),
}));

vi.mock("../utils/modelVersions", () => ({
  getMoveNetModelUrl: (version: string) => `mock-url-${version}`,
}));

import { useMovenet } from "../inference";

interface MovenetState {
  detector: unknown;
  isLoading: boolean;
  error: string | null;
  status: string;
}

function Probe({ onState }: { onState: (state: MovenetState) => void }) {
  const state = useMovenet();

  useEffect(() => {
    onState(state as MovenetState);
  }, [state, onState]);

  return <div>{state.status}</div>;
}

describe("useMovenet", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    disposeMock.mockReset();
    setBackendMock.mockResolvedValue(undefined);
    readyMock.mockResolvedValue(undefined);
    getBackendMock.mockReturnValue("webgl");
    createDetectorMock.mockResolvedValue({ dispose: disposeMock });
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

  it("loads detector with selected thunder model", async () => {
    let latest: MovenetState | null = null;

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

    const state = latest as unknown as MovenetState;
    expect(setBackendMock).toHaveBeenCalledWith("webgl");
    expect(createDetectorMock).toHaveBeenCalledWith("MoveNet", {
      modelType: "SINGLEPOSE_THUNDER",
      modelUrl: "mock-url-thunder",
      enableSmoothing: true,
    });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.status).toContain("successfully");

    await act(async () => {
      root.unmount();
    });

    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to wasm when webgl backend fails", async () => {
    setBackendMock
      .mockRejectedValueOnce(new Error("webgl not available"))
      .mockResolvedValueOnce(undefined);
    getBackendMock.mockReturnValue("wasm");

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Probe onState={() => {}} />);
      await Promise.resolve();
    });

    expect(setBackendMock).toHaveBeenNthCalledWith(1, "webgl");
    expect(setBackendMock).toHaveBeenNthCalledWith(2, "wasm");
    expect(createDetectorMock).toHaveBeenCalledTimes(1);
  });
});
