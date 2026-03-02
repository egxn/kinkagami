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

const makeFistAt = (x: number, y: number): HandKeypoint[] => {
  const points: HandKeypoint[] = [];
  for (let i = 0; i < 21; i++) {
    points.push({ x: x + (i % 2 === 0 ? 0 : 1), y: y + (i % 2 === 0 ? 0 : 1) });
  }
  return points;
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
        if (call < 3) {
          return [{ keypoints: makeFistAt(90, 50) }];
        }
        return [{ keypoints: makeFistAt(10, 50) }];
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

    await wait(180);

    expect(focus1).toHaveBeenCalledWith(true);
    expect(focus1).toHaveBeenCalledWith(false);
    expect(focus2).toHaveBeenCalledWith(true);
  });
});
