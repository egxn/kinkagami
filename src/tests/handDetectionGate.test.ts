import { afterEach, describe, expect, it, vi } from "vitest";
import {
  releaseHandDetectionLock,
  tryAcquireHandDetectionLock,
} from "../utils/handDetectionGate";

afterEach(() => {
  releaseHandDetectionLock("A");
  releaseHandDetectionLock("B");
  vi.useRealTimers();
});

describe("handDetectionGate", () => {
  it("owner can acquire a free lock", () => {
    expect(tryAcquireHandDetectionLock("A")).toBe(true);
  });

  it("same owner can re-acquire without releasing", () => {
    tryAcquireHandDetectionLock("A");
    expect(tryAcquireHandDetectionLock("A")).toBe(true);
  });

  it("different owner cannot acquire a held lock", () => {
    tryAcquireHandDetectionLock("A");
    expect(tryAcquireHandDetectionLock("B")).toBe(false);
  });

  it("lock is acquirable by new owner after release", () => {
    tryAcquireHandDetectionLock("A");
    releaseHandDetectionLock("A");
    expect(tryAcquireHandDetectionLock("B")).toBe(true);
  });

  it("releasing by wrong owner has no effect", () => {
    tryAcquireHandDetectionLock("A");
    releaseHandDetectionLock("B");
    expect(tryAcquireHandDetectionLock("B")).toBe(false);
  });

  it("stale lock (>2000ms) is automatically cleared on next acquire attempt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    tryAcquireHandDetectionLock("A");
    vi.setSystemTime(2001);
    expect(tryAcquireHandDetectionLock("B")).toBe(true);
  });
});
