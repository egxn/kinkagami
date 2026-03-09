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
  it("renders model and version selectors", () => {
    const html = renderToStaticMarkup(<Models />);

    expect(html).toContain("Modelo");
    expect(html).toContain("MoveNet versión");
    expect(html).toContain("BlazePose versión");
    expect(html).toContain("HandPose versión");
    expect(html).toContain("lightning (liviano)");
    expect(html).toContain("lite (liviano)");
  });
});
