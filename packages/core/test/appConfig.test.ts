import { describe, expect, it } from "vitest";
import {
  createAppConfigSanitizer,
  mergeAppConfig,
  type AppConfig,
} from "../src/config/appConfig";

const DEFAULTS: AppConfig = {
  models: {
    poseModel: "movenet",
    movenet: "lightning",
    blazepose: "lite",
    handpose: "lite",
  },
  camera: { flow: "web", source: "web", streamUrl: "http://cam/stream" },
  runtime: {
    execution: "python",
    backend: "wasm",
    pythonWebSocketUrl: "ws://127.0.0.1:8765",
    pythonStreamUrl: "http://localhost:8090/stream",
  },
  evaluation: { type: "fsm" },
};

const sanitize = createAppConfigSanitizer(DEFAULTS);

describe("appConfig", () => {
  it("returns defaults for non-objects", () => {
    expect(sanitize(null)).toBe(DEFAULTS);
    expect(sanitize("x")).toBe(DEFAULTS);
  });

  it("falls back per field and accepts the hybrid evaluation", () => {
    const out = sanitize({
      models: { poseModel: "nope", movenet: "thunder" },
      runtime: { execution: "site", pythonWebSocketUrl: "   " },
      evaluation: { type: "hybrid" },
    });
    expect(out.models.poseModel).toBe("movenet");
    expect(out.models.movenet).toBe("thunder");
    expect(out.runtime.execution).toBe("site");
    expect(out.runtime.pythonWebSocketUrl).toBe(
      DEFAULTS.runtime.pythonWebSocketUrl,
    );
    expect(out.evaluation.type).toBe("hybrid");
  });

  it("migrates the legacy mjpeg camera value", () => {
    const out = sanitize({ camera: { source: "mjpeg" } });
    expect(out.camera.source).toBe("streamUrl");
    expect(out.camera.flow).toBe("streamUrl");
  });

  it("merges updates per section", () => {
    const merged = mergeAppConfig(DEFAULTS, {
      runtime: { ...DEFAULTS.runtime, backend: "webgl" },
    });
    expect(merged.runtime.backend).toBe("webgl");
    expect(merged.models).toEqual(DEFAULTS.models);
  });
});
