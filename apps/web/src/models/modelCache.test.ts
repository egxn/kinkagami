import { describe, expect, it } from "vitest";
import { computeProgressRatio, extractShardUrls } from "./modelCache";

describe("modelCache", () => {
  it("lists shard URLs relative to model.json", () => {
    const json = {
      weightsManifest: [
        { paths: ["group1-shard1of2.bin", "group1-shard2of2.bin"] },
        { paths: ["extra.bin"] },
      ],
    };
    expect(
      extractShardUrls("/models/movenet/lightning/model.json", json),
    ).toEqual([
      "/models/movenet/lightning/group1-shard1of2.bin",
      "/models/movenet/lightning/group1-shard2of2.bin",
      "/models/movenet/lightning/extra.bin",
    ]);
  });

  it("tolerates malformed manifests", () => {
    expect(extractShardUrls("/a/model.json", null)).toEqual([]);
    expect(
      extractShardUrls("/a/model.json", { weightsManifest: [{ paths: 3 }] }),
    ).toEqual([]);
  });

  it("computes a clamped overall ratio", () => {
    expect(computeProgressRatio(1, 4, 0.5)).toBeCloseTo(0.375);
    expect(computeProgressRatio(4, 4, 2)).toBe(1);
    expect(computeProgressRatio(0, 0, 0)).toBe(1);
  });
});
