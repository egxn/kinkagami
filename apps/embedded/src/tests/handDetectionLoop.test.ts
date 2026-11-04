import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerButton,
  subscribeHandCursor,
  unregisterButton,
  updateDetectionConfig,
  type HandCursorState,
} from "../services/handDetectionLoop";

interface HandKeypoint {
  x: number;
  y: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const makeVideo = () => {
  const video = document.createElement("video");
  Object.defineProperty(video, "videoWidth", { value: 100, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: 100, configurable: true });
  video.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return video;
};

const makeElementRect = (left: number, right: number) => {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ left, right, top: 0, bottom: 100, width: right - left, height: 100, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
  return el;
};

// Fingertips bunched near wrist: normAvgToWrist ≈ 0.77 < FIST_NORM_THRESHOLD(0.95)
const makeFistAt = (x: number, y: number): HandKeypoint[] => {
  const pts: HandKeypoint[] = Array.from({ length: 21 }, () => ({ x, y }));
  pts[9]  = { x: x,      y: y - 50 }; // middle MCP → hand size = 50px
  pts[4]  = { x: x - 10, y: y - 38 }; // thumb tip
  pts[8]  = { x: x -  5, y: y - 40 }; // index tip
  pts[12] = { x: x,      y: y - 42 }; // middle tip
  pts[16] = { x: x +  5, y: y - 38 }; // ring tip
  pts[20] = { x: x + 10, y: y - 32 }; // pinky tip
  return pts;
};

// Fingertips spread far from wrist: normAvgToWrist ≈ 1.59 > OPEN_NORM_THRESHOLD(1.40)
// Tips use large y-offsets so they land outside any button's viewport bounds (py<0).
const makeOpenHandAt = (x: number, y: number): HandKeypoint[] => {
  const pts: HandKeypoint[] = Array.from({ length: 21 }, () => ({ x, y }));
  pts[9]  = { x: x,      y: y - 50 }; // middle MCP → hand size = 50px
  pts[4]  = { x: x - 30, y: y - 60 }; // thumb tip  (dist ≈ 67.1)
  pts[8]  = { x: x - 15, y: y - 85 }; // index tip  (dist ≈ 86.3)
  pts[12] = { x: x,      y: y - 90 }; // middle tip (dist = 90)
  pts[16] = { x: x + 15, y: y - 85 }; // ring tip   (dist ≈ 86.3)
  pts[20] = { x: x + 30, y: y - 60 }; // pinky tip  (dist ≈ 67.1)
  return pts;
};

afterEach(() => {
  updateDetectionConfig(null, null, false);
  unregisterButton(1);
  unregisterButton(2);
  vi.restoreAllMocks();
});

describe("handDetectionLoop", () => {
  it("publishes visible cursor when hand keypoints are detected", async () => {
    const video = makeVideo();
    const element = makeElementRect(0, 100);

    const detector = {
      estimateHands: vi.fn(async () => [{ keypoints: [{ x: 50, y: 50 }] }]),
    };

    const cursorStates: HandCursorState[] = [];
    const unsubscribe = subscribeHandCursor((state) => {
      cursorStates.push(state);
    });

    updateDetectionConfig(video, detector, true);
    registerButton({
      id: 1,
      getElement: () => element,
      mode: "default",
      checked: false,
      onHoverChange: () => {},
      onFocusChange: () => {},
      onAction: () => {},
      onDiscard: () => {},
    });

    await wait(80);

    const latest = cursorStates[cursorStates.length - 1];
    expect(latest.visible).toBe(true);
    expect(latest.x).toBeGreaterThanOrEqual(0);
    expect(latest.y).toBeGreaterThanOrEqual(0);

    unsubscribe();
  });

  it("keeps focus exclusive between two buttons", async () => {
    const video = makeVideo();
    const leftButton = makeElementRect(0, 40);
    const rightButton = makeElementRect(60, 100);

    const focus1 = vi.fn();
    const focus2 = vi.fn();

    let call = 0;
    const detector = {
      estimateHands: vi.fn(async () => {
        call += 1;
        if (call === 1) return [{ keypoints: makeOpenHandAt(90, 50) }]; // open  → phase: open
        if (call === 2) return [{ keypoints: makeFistAt(90, 50) }];     // fist  → phase: fist
        if (call === 3) return [{ keypoints: makeOpenHandAt(90, 50) }]; // open  → fires on btn 1
        if (call === 4) return [{ keypoints: makeOpenHandAt(10, 50) }]; // open  → phase stays open
        if (call === 5) return [{ keypoints: makeFistAt(10, 50) }];     // fist  → phase: fist
        return [{ keypoints: makeOpenHandAt(10, 50) }];                 // open  → fires on btn 2
      }),
    };

    updateDetectionConfig(video, detector, true);

    registerButton({
      id: 1,
      getElement: () => leftButton,
      mode: "default",
      checked: false,
      onHoverChange: () => {},
      onFocusChange: focus1,
      onAction: () => {},
      onDiscard: () => {},
    });

    registerButton({
      id: 2,
      getElement: () => rightButton,
      mode: "default",
      checked: false,
      onHoverChange: () => {},
      onFocusChange: focus2,
      onAction: () => {},
      onDiscard: () => {},
    });

    await wait(300);

    expect(focus1).toHaveBeenCalledWith(true);
    expect(focus1).toHaveBeenCalledWith(false);
    expect(focus2).toHaveBeenCalledWith(true);
  });
});
