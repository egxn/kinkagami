/**
 * Centralized hand detection loop.
 *
 * Instead of each Button running its own setTimeout loop (N buttons = N loops
 * competing for a single lock), this service runs ONE loop that calls
 * estimateHands once per frame and distributes the result to every registered
 * button.  On a Radxa-class SBC the savings are significant.
 */
import { logger } from "../utils/logger";

// ---- Types ----

interface HandKeypoint {
  x: number;
  y: number;
}

interface HandPrediction {
  keypoints?: HandKeypoint[];
}

interface HandDetector {
  estimateHands: (
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ) => Promise<unknown[]>;
}

export interface HandCursorState {
  visible: boolean;
  x: number;
  y: number;
  lastEvent: "confirm" | "discard" | null;
  eventSequence: number;
}

export interface ButtonRegistration {
  id: number;
  getElement: () => HTMLDivElement | null;
  mode: "default" | "checkbox";
  checked: boolean;
  requireSecondFistForAction?: boolean;
  onHoverChange: (hovered: boolean) => void;
  onFocusChange: (focused: boolean) => void;
  onAction: () => void;
  onDiscard: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
}

// ---- Button registry ----

const registrations = new Map<number, ButtonRegistration>();

// ---- Detection dependencies (set by any mounted Button) ----

let video: HTMLVideoElement | null = null;
let detector: HandDetector | null = null;
let streamReady = false;

// ---- Loop state ----

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let loopRunning = false;

// ---- Global gesture state ----

let focusedButtonId: number | null = null;
let hoveredDefaultButtonId: number | null = null;
let previousCenterX: number | null = null;
let previousCenterY: number | null = null;

// ---- Per-button state ----

const hoverFlags = new Map<number, boolean>();
const hoverTargets = new Map<number, boolean>();
const hoverTargetTimes = new Map<number, number>();
const focusFlags = new Map<number, boolean>();

// ---- Cursor state subscribers ----

let cursorState: HandCursorState = {
  visible: false,
  x: 0,
  y: 0,
  lastEvent: null,
  eventSequence: 0,
};
const cursorSubscribers = new Set<(state: HandCursorState) => void>();
let lastCursorSeenAt = 0;

const emitCursorState = (next: Partial<HandCursorState>) => {
  cursorState = {
    ...cursorState,
    ...next,
  };

  for (const subscriber of cursorSubscribers) {
    subscriber(cursorState);
  }
};

const setFocused = (id: number, focused: boolean) => {
  const prev = focusFlags.get(id) ?? false;
  if (prev === focused) return;
  focusFlags.set(id, focused);
  registrations.get(id)?.onFocusChange(focused);
};

// ---- Error tracking ----

let backendErrorCount = 0;
let lastBackendErrorLogAt = 0;

// ---- Constants ----

const FINGERTIP_INDEXES = [4, 8, 12, 16, 20];
const WRIST_INDEX = 0;
const HAND_HOVER_DEBOUNCE_MS = 120;
const DETECT_INTERVAL_MS = 30;
const IDLE_INTERVAL_MS = 200;
const CURSOR_VISIBILITY_GRACE_MS = 1400;

// ---- Gesture helpers ----

const dist = (a: HandKeypoint, b: HandKeypoint) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const isFist = (estimations: HandPrediction[]): boolean => {
  const kps = estimations[0]?.keypoints;
  if (!kps || kps.length < 21) return false;

  const wrist = kps[WRIST_INDEX];
  const tips = FINGERTIP_INDEXES.map((i) => kps[i]).filter(Boolean);
  if (!wrist || tips.length !== FINGERTIP_INDEXES.length) return false;

  const avgToWrist =
    tips.reduce((sum, t) => sum + dist(t, wrist), 0) / tips.length;

  let pairs = 0;
  let pairDist = 0;
  for (let i = 0; i < tips.length; i++) {
    for (let j = i + 1; j < tips.length; j++) {
      pairDist += dist(tips[i], tips[j]);
      pairs++;
    }
  }

  return avgToWrist < 90 && (pairs > 0 ? pairDist / pairs : Infinity) < 55;
};

const swipeH = (
  estimations: HandPrediction[],
  prevX: number | null,
): { dir: "left" | "right" | null; cx: number | null } => {
  const kps = estimations[0]?.keypoints;
  if (!kps?.length) return { dir: null, cx: null };
  const cx = kps.reduce((s, k) => s + k.x, 0) / kps.length;
  if (prevX == null) return { dir: null, cx };
  const d = cx - prevX;
  if (d > 45) return { dir: "right", cx };
  if (d < -45) return { dir: "left", cx };
  return { dir: null, cx };
};

const swipeV = (
  estimations: HandPrediction[],
  prevY: number | null,
): { dir: "up" | "down" | null; cy: number | null } => {
  const kps = estimations[0]?.keypoints;
  if (!kps?.length) return { dir: null, cy: null };
  const cy = kps.reduce((s, k) => s + k.y, 0) / kps.length;
  if (prevY == null) return { dir: null, cy };
  const d = cy - prevY;
  if (d < -35) return { dir: "up", cy };
  if (d > 35) return { dir: "down", cy };
  return { dir: null, cy };
};

const handOverElement = (
  kps: HandKeypoint[],
  v: HTMLVideoElement,
  el: HTMLDivElement,
): boolean => {
  const vr = v.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (vr.width <= 0 || vr.height <= 0) return false;
  return kps.some((kp) => {
    const mx = vr.right - (kp.x / v.videoWidth) * vr.width;
    const py = vr.top + (kp.y / v.videoHeight) * vr.height;
    return mx >= er.left && mx <= er.right && py >= er.top && py <= er.bottom;
  });
};

const mapKeypointToViewport = (
  kp: HandKeypoint,
  v: HTMLVideoElement,
): { x: number; y: number } => {
  const vr = v.getBoundingClientRect();
  return {
    x: vr.right - (kp.x / v.videoWidth) * vr.width,
    y: vr.top + (kp.y / v.videoHeight) * vr.height,
  };
};

const isTransientError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("backend") ||
    m.includes("movedata") ||
    m.includes("info is undefined") ||
    m.includes("can't access property \"backend\"")
  );
};

// ---- Detection loop ----

function schedule(ms: number) {
  if (!loopRunning) return;
  timeoutId = setTimeout(detect, ms);
}

async function detect() {
  if (!loopRunning) return;

  let nextDelay = IDLE_INTERVAL_MS;

  const v = video;
  const det = detector;

  if (
    !det ||
    !v ||
    !streamReady ||
    v.videoWidth === 0 ||
    v.videoHeight === 0 ||
    registrations.size === 0
  ) {
    const now = Date.now();
    if (cursorState.visible && now - lastCursorSeenAt > CURSOR_VISIBILITY_GRACE_MS) {
      emitCursorState({ visible: false });
    }

    for (const [id, reg] of registrations) {
      if (hoverFlags.get(id)) {
        hoverFlags.set(id, false);
        reg.onHoverChange(false);
      }
      setFocused(id, false);
      if (hoveredDefaultButtonId === id) hoveredDefaultButtonId = null;
      hoverTargets.set(id, false);
      hoverTargetTimes.set(id, 0);
    }
    schedule(IDLE_INTERVAL_MS);
    return;
  }

  nextDelay = DETECT_INTERVAL_MS;

  try {
    if (v.width !== v.videoWidth) v.width = v.videoWidth;
    if (v.height !== v.videoHeight) v.height = v.videoHeight;

    const estimations = (await det.estimateHands(v)) as HandPrediction[];
    if (!loopRunning) return;

    const handKps = estimations[0]?.keypoints ?? [];

    if (handKps.length > 0) {
      const center = handKps.reduce(
        (acc, kp) => {
          const mapped = mapKeypointToViewport(kp, v);
          return {
            x: acc.x + mapped.x,
            y: acc.y + mapped.y,
          };
        },
        { x: 0, y: 0 },
      );

      emitCursorState({
        visible: true,
        x: center.x / handKps.length,
        y: center.y / handKps.length,
      });
      lastCursorSeenAt = Date.now();
    } else if (
      cursorState.visible &&
      Date.now() - lastCursorSeenAt > CURSOR_VISIBILITY_GRACE_MS
    ) {
      emitCursorState({ visible: false });
    }

    const now = Date.now();
    const fist = isFist(estimations);

    const { dir: hDir, cx } = swipeH(estimations, previousCenterX);
    previousCenterX = cx;
    const { dir: vDir, cy } = swipeV(estimations, previousCenterY);
    previousCenterY = cy;

    for (const [id, reg] of registrations) {
      const el = reg.getElement();
      if (!el) continue;

      const over =
        handKps.length > 0 ? handOverElement(handKps, v, el) : false;

      // ---- Hover ----
      const canHover =
        over &&
        !(reg.mode === "checkbox" && reg.checked) &&
        (focusedButtonId == null || focusedButtonId === id);
      let effectiveHover = canHover;

      if (reg.mode === "default") {
        if (canHover) {
          if (
            hoveredDefaultButtonId == null ||
            hoveredDefaultButtonId === id
          ) {
            hoveredDefaultButtonId = id;
          }
          effectiveHover = hoveredDefaultButtonId === id;
        } else {
          if (hoveredDefaultButtonId === id) hoveredDefaultButtonId = null;
          effectiveHover = false;
        }
      }

      const prevTarget = hoverTargets.get(id) ?? false;
      if (prevTarget !== effectiveHover) {
        hoverTargets.set(id, effectiveHover);
        hoverTargetTimes.set(id, now);
      }

      const prevHover = hoverFlags.get(id) ?? false;
      const curTarget = hoverTargets.get(id) ?? false;
      const changedAt = hoverTargetTimes.get(id) ?? 0;
      if (
        prevHover !== curTarget &&
        now - changedAt >= HAND_HOVER_DEBOUNCE_MS
      ) {
        hoverFlags.set(id, curTarget);
        reg.onHoverChange(curTarget);
      }

      // ---- Action (fist on button) ----
      if (over && fist) {
        logger.log("Button", `Hand action confirmed (fist) on button ${id}`);
        const wasFocused = focusedButtonId;
        const wasAlreadyFocused = focusedButtonId === id;
        focusedButtonId = id;
        if (wasFocused != null && wasFocused !== id) {
          setFocused(wasFocused, false);
        }
        for (const otherId of registrations.keys()) {
          if (otherId !== id) setFocused(otherId, false);
        }
        setFocused(id, true);
        const requireSecondFist = !!reg.requireSecondFistForAction;
        const shouldTriggerAction = !requireSecondFist || wasAlreadyFocused;

        if (shouldTriggerAction) {
          reg.onAction();
          emitCursorState({
            lastEvent: "confirm",
            eventSequence: cursorState.eventSequence + 1,
          });
        }
        previousCenterX = null;
        previousCenterY = null;
        break; // one action per frame
      }

      // ---- Swipe (only focused button) ----
      if (focusedButtonId === id) {
        if (over && hDir) {
          logger.log("Button", `Hand swipe ${hDir} on focused button ${id}`);
          reg.onDiscard();
          emitCursorState({
            lastEvent: "discard",
            eventSequence: cursorState.eventSequence + 1,
          });
          setFocused(id, false);
          focusedButtonId = null;
          previousCenterX = null;
          previousCenterY = null;
        } else if (over && vDir) {
          if (vDir === "up" && reg.onIncrease) {
            logger.log("Button", "Hand swipe up (increase)");
            reg.onIncrease();
          } else if (vDir === "down" && reg.onDecrease) {
            logger.log("Button", "Hand swipe down (decrease)");
            reg.onDecrease();
          }
        }
      }
    }

    backendErrorCount = 0;
  } catch (err) {
    if (isTransientError(err)) {
      backendErrorCount++;
      nextDelay = Math.min(600, 120 + backendErrorCount * 70);

      for (const [id, reg] of registrations) {
        if (hoverFlags.get(id)) {
          hoverFlags.set(id, false);
          reg.onHoverChange(false);
        }
        if (hoveredDefaultButtonId === id) hoveredDefaultButtonId = null;
      }

      const now = Date.now();
      if (now - lastBackendErrorLogAt > 2000) {
        lastBackendErrorLogAt = now;
        logger.warn(
          "Button",
          "Transient TensorFlow backend error; retrying.",
        );
      }
    } else {
      logger.error("Button", "Hand detection error", err);
    }
  }

  schedule(nextDelay);
}

function startLoop() {
  if (loopRunning) return;
  loopRunning = true;
  logger.log("handDetectionLoop", "Starting centralized detection loop");
  detect();
}

function stopLoop() {
  loopRunning = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  focusedButtonId = null;
  hoveredDefaultButtonId = null;
  previousCenterX = null;
  previousCenterY = null;
  backendErrorCount = 0;
  lastCursorSeenAt = 0;
  if (cursorState.visible) {
    emitCursorState({ visible: false });
  }
  logger.log("handDetectionLoop", "Stopped centralized detection loop");
}

// ---- Public API ----

export function updateDetectionConfig(
  videoEl: HTMLVideoElement | null,
  det: HandDetector | null,
  ready: boolean,
) {
  video = videoEl;
  detector = det;
  streamReady = ready;
}

export function registerButton(reg: ButtonRegistration) {
  registrations.set(reg.id, reg);
  if (!loopRunning && registrations.size > 0) startLoop();
}

export function unregisterButton(id: number) {
  registrations.delete(id);
  hoverFlags.delete(id);
  hoverTargets.delete(id);
  hoverTargetTimes.delete(id);
  focusFlags.delete(id);

  if (focusedButtonId === id) focusedButtonId = null;
  if (hoveredDefaultButtonId === id) hoveredDefaultButtonId = null;

  if (registrations.size === 0) stopLoop();
}

export function subscribeHandCursor(
  subscriber: (state: HandCursorState) => void,
): () => void {
  cursorSubscribers.add(subscriber);
  subscriber(cursorState);

  return () => {
    cursorSubscribers.delete(subscriber);
  };
}
