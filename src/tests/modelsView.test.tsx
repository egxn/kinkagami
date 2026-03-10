import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../context/usePoseContext", () => ({
  default: () => ({
    cameraError: null,
    cameraReady: true,
    detector: null,
    modelError: null,
    modelLoading: false,
    stream: null,
    streamReady: true,
    videoRef: { current: null },
  }),
}));

vi.mock("../hooks", () => ({
  useBlazePose: () => ({ detector: null, isLoading: false, error: null, status: "ok" }),
  useHandPose: () => ({ detector: null, isLoading: false, error: null, status: "ok" }),
  useAppConfig: () => ({
    config: {
      models: {
        poseModel: "blazepose",
        movenet: "lightning",
        blazepose: "lite",
        handpose: "lite",
      },
      camera: {
        flow: "web",
        source: "web",
        streamUrl: "http://localhost:8090/?action=stream",
      },
      runtime: { execution: "workers" },
      evaluation: { type: "fsm" },
    },
    patchConfig: vi.fn(),
    replaceConfig: vi.fn(),
  }),
  useModelVersions: () => ({
    config: { movenet: "lightning", blazepose: "lite", handpose: "lite" },
    updateConfig: vi.fn(),
  }),
  usePoseDetection: () => {},
}));

vi.mock("../components/Skeleton", () => ({
  default: () => <div>SkeletonMock</div>,
}));

import Models from "../views/Models";

describe("Models view", () => {
  it("renders model selector and selected model variation selector", () => {
    const html = renderToStaticMarkup(<Models />);

    expect(html).toContain("Modelo");
    expect(html).toContain("BlazePose versión");
    expect(html).toContain("lite (liviano)");
  });
});
