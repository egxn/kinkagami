import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_VERSIONS,
  getBlazePoseLandmarkUrl,
  getHandPoseDetectorUrl,
  getHandPoseLandmarkUrl,
  getModelVersionsConfig,
  getMoveNetModelUrl,
  MODEL_VERSIONS_STORAGE_KEY,
  saveModelVersionsConfig,
} from "../utils/modelVersions";

describe("modelVersions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns lightweight defaults when no config exists", () => {
    expect(getModelVersionsConfig()).toEqual(DEFAULT_MODEL_VERSIONS);
  });

  it("persists and reads model versions from localStorage", () => {
    const saved = saveModelVersionsConfig({
      movenet: "thunder",
      blazepose: "heavy",
      handpose: "full",
    });

    expect(saved).toEqual({
      movenet: "thunder",
      blazepose: "heavy",
      handpose: "full",
    });

    const raw = window.localStorage.getItem(MODEL_VERSIONS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(getModelVersionsConfig()).toEqual(saved);
  });

  it("sanitizes invalid localStorage values", () => {
    window.localStorage.setItem(
      MODEL_VERSIONS_STORAGE_KEY,
      JSON.stringify({
        movenet: "invalid",
        blazepose: "full",
        handpose: "invalid",
      }),
    );

    expect(getModelVersionsConfig()).toEqual({
      movenet: "lightning",
      blazepose: "full",
      handpose: "lite",
    });
  });

  it("builds expected model URLs", () => {
    expect(getMoveNetModelUrl("lightning")).toBe(
      "/models/movenet/lightning/model.json",
    );
    expect(getMoveNetModelUrl("thunder")).toBe(
      "/models/movenet/thunder/model.json",
    );
    expect(getBlazePoseLandmarkUrl("lite")).toBe(
      "/models/blazepose/landmark-lite/model.json",
    );
    expect(getHandPoseDetectorUrl("full")).toBe(
      "/models/handpose/detector-full/model.json",
    );
    expect(getHandPoseLandmarkUrl("lite")).toBe(
      "/models/handpose/landmark-lite/model.json",
    );
  });
});
