import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../components/Button", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-mock="button">{children}</div>
  ),
}));

const mockPoseContext = {
  cameraError: null,
  cameraReady: false,
  streamReady: false,
  videoRef: { current: null },
  stream: null,
  detector: null,
  modelLoading: false,
  modelError: null,
  onStreamReady: null,
};

vi.mock("../context/usePoseContext", () => ({
  default: () => mockPoseContext,
}));

let mockCameraSource = { flow: "streamUrl" as const, streamUrl: "http://localhost:8090/stream" };

vi.mock("../hooks", () => ({
  useCameraSource: () => mockCameraSource,
}));

import Splash from "../views/Splash";

describe("Splash view", () => {
  it("shows loading spinner when streamUrl and camera not ready", () => {
    mockCameraSource = { flow: "streamUrl", streamUrl: "http://localhost:8090/stream" };
    mockPoseContext.cameraReady = false;
    const html = renderToStaticMarkup(<Splash />);
    expect(html).toContain("splash-loading__spinner");
    expect(html).toContain("Conectando con la cámara");
  });

  it("shows start button when streamUrl and camera is ready", () => {
    mockCameraSource = { flow: "streamUrl", streamUrl: "http://localhost:8090/stream" };
    mockPoseContext.cameraReady = true;
    mockPoseContext.streamReady = true;
    const html = renderToStaticMarkup(<Splash />);
    expect(html).not.toContain("splash-loading__spinner");
    expect(html).toContain("Iniciar");
  });

  it("shows start button immediately when flow is web", () => {
    mockCameraSource = { flow: "web", streamUrl: "" };
    mockPoseContext.cameraReady = false;
    const html = renderToStaticMarkup(<Splash />);
    expect(html).not.toContain("splash-loading__spinner");
    expect(html).toContain("Iniciar");
  });
});
