import { Children, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useHandPose } from "../hooks";
import { logger } from "../utils/logger";
import { releaseHandDetectionLock, tryAcquireHandDetectionLock } from "../utils/handDetectionGate";
import "./Button.scss";

interface HandKeypoint {
  x: number;
  y: number;
}

interface HandPrediction {
  keypoints?: HandKeypoint[];
}

interface ButtonProps {
  children: React.ReactNode;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamReady: boolean;
  onAction: () => void;
  onDiscard: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
  className?: string;
  style?: CSSProperties;
  alignX?: "auto" | "left" | "center";
  mode?: "default" | "checkbox";
  checked?: boolean;
}

let focusedButtonId: number | null = null;
let hoveredDefaultButtonId: number | null = null;
let globalActionCooldownUntil = 0;
let buttonIdCounter = 0;

const FINGERTIP_INDEXES = [4, 8, 12, 16, 20];
const WRIST_INDEX = 0;
const HAND_HOVER_DEBOUNCE_MS = 120;
const ROUTE_ACTION_COOLDOWN_MS = 1800;

const isTransientBackendError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("backend") ||
    message.includes("movedata") ||
    message.includes("info is undefined") ||
    message.includes("can't access property \"backend\"")
  );
};

const isTextOnlyNode = (node: React.ReactNode): boolean => {
  if (node == null || typeof node === "boolean") return true;
  if (typeof node === "string") return node.trim().length > 0;
  if (typeof node === "number") return true;
  if (Array.isArray(node)) return node.every((child) => isTextOnlyNode(child));

  if (isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return isTextOnlyNode(props.children);
  }

  return false;
};

const distance = (a: HandKeypoint, b: HandKeypoint) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const confirmFromEstimation = (estimations: HandPrediction[]): boolean => {
  const hand = estimations[0];
  const keypoints = hand?.keypoints;
  if (!keypoints || keypoints.length < 21) return false;

  const wrist = keypoints[WRIST_INDEX];
  const tips = FINGERTIP_INDEXES.map((index) => keypoints[index]).filter(Boolean);
  if (!wrist || tips.length !== FINGERTIP_INDEXES.length) return false;

  const avgTipToWrist =
    tips.reduce((sum, tip) => sum + distance(tip, wrist), 0) / tips.length;

  let pairCount = 0;
  let pairDistanceSum = 0;
  for (let i = 0; i < tips.length; i++) {
    for (let j = i + 1; j < tips.length; j++) {
      pairDistanceSum += distance(tips[i], tips[j]);
      pairCount++;
    }
  }
  const avgTipSpread = pairCount > 0 ? pairDistanceSum / pairCount : Infinity;

  return avgTipToWrist < 90 && avgTipSpread < 55;
};

const discardFromEstimation = (
  estimations: HandPrediction[],
  previousCenterX: number | null,
): { direction: "left" | "right" | null; centerX: number | null } => {
  const hand = estimations[0];
  const keypoints = hand?.keypoints;
  if (!keypoints || keypoints.length === 0) {
    return { direction: null, centerX: null };
  }

  const centerX = keypoints.reduce((sum, kp) => sum + kp.x, 0) / keypoints.length;
  if (previousCenterX == null) {
    return { direction: null, centerX };
  }

  const delta = centerX - previousCenterX;
  const swipeThreshold = 45;

  if (delta > swipeThreshold) {
    return { direction: "right", centerX };
  }

  if (delta < -swipeThreshold) {
    return { direction: "left", centerX };
  }

  return { direction: null, centerX };
};

const verticalFromEstimation = (
  estimations: HandPrediction[],
  previousCenterY: number | null,
): { direction: "up" | "down" | null; centerY: number | null } => {
  const hand = estimations[0];
  const keypoints = hand?.keypoints;
  if (!keypoints || keypoints.length === 0) {
    return { direction: null, centerY: null };
  }

  const centerY = keypoints.reduce((sum, kp) => sum + kp.y, 0) / keypoints.length;
  if (previousCenterY == null) {
    return { direction: null, centerY };
  }

  const delta = centerY - previousCenterY;
  const swipeThreshold = 35;

  if (delta < -swipeThreshold) {
    return { direction: "up", centerY };
  }

  if (delta > swipeThreshold) {
    return { direction: "down", centerY };
  }

  return { direction: null, centerY };
};

export default function Button({
  children,
  videoRef,
  streamReady,
  onAction,
  onDiscard,
  onIncrease,
  onDecrease,
  className,
  style,
  alignX = "auto",
  mode = "default",
  checked = false,
}: ButtonProps) {
  const { detector, isLoading, error } = useHandPose();

  const previousCenterXRef = useRef<number | null>(null);
  const previousCenterYRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef(0);
  const handHoverRef = useRef(false);
  const hoverTargetRef = useRef(false);
  const hoverTargetChangedAtRef = useRef(0);
  const backendErrorCountRef = useRef(0);
  const lastBackendErrorLogAtRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonIdRef = useRef<number>(++buttonIdCounter);
  const lockOwnerRef = useRef(`button-${buttonIdRef.current}`);
  const [isHovered, setIsHovered] = useState(false);

  const canDetect = useMemo(
    () => !!detector && !isLoading && !error && streamReady,
    [detector, isLoading, error, streamReady],
  );

  const isCameraLoading = !streamReady;
  const isModelLoading = isLoading;
  const isAnyLoading = isCameraLoading || isModelLoading;
  const hasChildren = Children.count(children) > 0;
  const hasOnlyTextChildren = useMemo(() => isTextOnlyNode(children), [children]);
  const useLargeMinimumSize = !hasChildren || hasOnlyTextChildren;
  const isFocused = focusedButtonId === buttonIdRef.current;
  const contentAlignX: "left" | "center" =
    alignX === "auto" ? (hasOnlyTextChildren ? "center" : "left") : alignX;

  const resolveVisualStyle = () => {
    if (isCameraLoading) {
      return {
        border: "2px solid var(--kgm-button-loading-border)",
        backgroundColor: "var(--kgm-button-loading-surface)",
      };
    }

    if (isModelLoading) {
      return {
        border: "2px solid var(--kgm-button-loading-border)",
        backgroundColor: "var(--kgm-button-loading-surface)",
      };
    }

    if (mode === "checkbox" && checked) {
      if (isFocused) {
        return {
          border: "4px solid var(--kgm-button-checkbox-checked-focus-border)",
          backgroundColor: "var(--kgm-button-checkbox-checked-focus-surface)",
        };
      }

      return {
        border: "4px solid var(--kgm-button-checkbox-checked-border)",
        backgroundColor: "var(--kgm-button-checkbox-checked-surface)",
      };
    }

    if (mode === "checkbox" && isFocused) {
      return {
        border: "2px solid var(--kgm-button-checkbox-hover-border)",
        backgroundColor: "var(--kgm-button-checkbox-hover-surface)",
      };
    }

    if (isFocused) {
      return {
        border: "2px solid var(--kgm-button-focus-border)",
        backgroundColor: "var(--kgm-button-focus-surface)",
      };
    }

    if (isHovered) {
      if (mode === "checkbox") {
        return {
          border: "2px solid var(--kgm-button-checkbox-hover-border)",
          backgroundColor: "var(--kgm-button-checkbox-hover-surface)",
        };
      }

      return {
        border: "2px solid var(--kgm-button-hover-border)",
        backgroundColor: "var(--kgm-button-hover-surface)",
      };
    }

    return {
      border: "2px solid var(--kgm-button-idle-border)",
      backgroundColor: "var(--kgm-button-idle-surface)",
    };
  };

  const isHandOverButton = (
    keypoints: HandKeypoint[],
    video: HTMLVideoElement,
    element: HTMLDivElement | null,
  ) => {
    if (!element) return false;

    const videoRect = video.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    if (videoRect.width <= 0 || videoRect.height <= 0) return false;

    return keypoints.some((keypoint) => {
      const ratioX = keypoint.x / video.videoWidth;
      const ratioY = keypoint.y / video.videoHeight;

      const mirroredX = videoRect.right - ratioX * videoRect.width;
      const projectedY = videoRect.top + ratioY * videoRect.height;

      return (
        mirroredX >= elementRect.left &&
        mirroredX <= elementRect.right &&
        projectedY >= elementRect.top &&
        projectedY <= elementRect.bottom
      );
    });
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;
    const currentButtonId = buttonIdRef.current;

    const detect = async () => {
      if (!mounted) return;

      let nextDelayMs = 30;

      const video = videoRef.current;
      const handDetector = detector;
      const wrapperElement = wrapperRef.current;
      if (
        !canDetect ||
        !handDetector ||
        !video ||
        !wrapperElement ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        if (handHoverRef.current) {
          handHoverRef.current = false;
          if (mounted) {
            setIsHovered(false);
          }
        }
        if (hoveredDefaultButtonId === currentButtonId) {
          hoveredDefaultButtonId = null;
        }
        hoverTargetRef.current = false;
        hoverTargetChangedAtRef.current = 0;
        timeoutId = setTimeout(detect, 80);
        return;
      }

      try {
        if (!tryAcquireHandDetectionLock(lockOwnerRef.current)) {
          timeoutId = setTimeout(detect, 90);
          return;
        }

        if (video.width !== video.videoWidth) video.width = video.videoWidth;
        if (video.height !== video.videoHeight) video.height = video.videoHeight;

        const estimations = (await handDetector.estimateHands(video)) as HandPrediction[];
        if (!mounted) return;
        const firstHandKeypoints = estimations[0]?.keypoints ?? [];
        const handOverButton =
          firstHandKeypoints.length > 0
            ? isHandOverButton(firstHandKeypoints, video, wrapperElement)
            : false;

        const now = Date.now();
        const canShowHandHover = handOverButton && !(mode === "checkbox" && checked);
        const isDefaultMode = mode === "default";
        let effectiveHandHover = canShowHandHover;

        if (isDefaultMode) {
          if (canShowHandHover) {
            if (
              hoveredDefaultButtonId == null ||
              hoveredDefaultButtonId === buttonIdRef.current
            ) {
              hoveredDefaultButtonId = buttonIdRef.current;
            }
            effectiveHandHover = hoveredDefaultButtonId === buttonIdRef.current;
          } else {
            if (hoveredDefaultButtonId === buttonIdRef.current) {
              hoveredDefaultButtonId = null;
            }
            effectiveHandHover = false;
          }
        }

        if (hoverTargetRef.current !== effectiveHandHover) {
          hoverTargetRef.current = effectiveHandHover;
          hoverTargetChangedAtRef.current = now;
        }

        if (
          handHoverRef.current !== hoverTargetRef.current &&
          now - hoverTargetChangedAtRef.current >= HAND_HOVER_DEBOUNCE_MS
        ) {
          handHoverRef.current = hoverTargetRef.current;
          if (mounted) {
            setIsHovered(handHoverRef.current);
          }
        }

        const isFocused = focusedButtonId === buttonIdRef.current;

        const confirm = confirmFromEstimation(estimations);
        if (
          handOverButton &&
          confirm &&
          now >= cooldownUntilRef.current &&
          now >= globalActionCooldownUntil
        ) {
          logger.log("Button", "Hand action confirmed (fist)");
          if (focusedButtonId !== buttonIdRef.current) {
            focusedButtonId = buttonIdRef.current;
          }
          cooldownUntilRef.current = now + 800;
          globalActionCooldownUntil = now + ROUTE_ACTION_COOLDOWN_MS;
          onAction();
          previousCenterXRef.current = null;
          previousCenterYRef.current = null;
          return;
        }

        const { direction, centerX } = discardFromEstimation(
          estimations,
          previousCenterXRef.current,
        );
        previousCenterXRef.current = centerX;

        if (isFocused && direction && now >= cooldownUntilRef.current) {
          logger.log("Button", `Hand action discarded (swipe ${direction})`);
          cooldownUntilRef.current = now + 800;
          onDiscard();
          focusedButtonId = null;
          previousCenterXRef.current = null;
          previousCenterYRef.current = null;
        }

        const { direction: verticalDirection, centerY } = verticalFromEstimation(
          estimations,
          previousCenterYRef.current,
        );
        previousCenterYRef.current = centerY;

        if (isFocused && verticalDirection && now >= cooldownUntilRef.current) {
          if (verticalDirection === "up" && onIncrease) {
            logger.log("Button", "Hand action increase (swipe up)");
            cooldownUntilRef.current = now + 500;
            onIncrease();
          }

          if (verticalDirection === "down" && onDecrease) {
            logger.log("Button", "Hand action decrease (swipe down)");
            cooldownUntilRef.current = now + 500;
            onDecrease();
          }
        }

        backendErrorCountRef.current = 0;
      } catch (detectionError) {
        if (isTransientBackendError(detectionError)) {
          backendErrorCountRef.current += 1;
          nextDelayMs = Math.min(600, 120 + backendErrorCountRef.current * 70);

          if (handHoverRef.current) {
            handHoverRef.current = false;
            if (mounted) {
              setIsHovered(false);
            }
          }

          if (hoveredDefaultButtonId === currentButtonId) {
            hoveredDefaultButtonId = null;
          }

          const now = Date.now();
          if (now - lastBackendErrorLogAtRef.current > 2000) {
            lastBackendErrorLogAtRef.current = now;
            logger.warn(
              "Button",
              "Transient TensorFlow backend error while estimating hands; retrying.",
            );
          }
        } else {
          logger.error("Button", "Hand detection error", detectionError);
        }
      } finally {
        releaseHandDetectionLock(lockOwnerRef.current);
        if (mounted) {
          timeoutId = setTimeout(detect, nextDelayMs);
        }
      }
    };

    detect();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (focusedButtonId === currentButtonId) {
        focusedButtonId = null;
      }
      if (hoveredDefaultButtonId === currentButtonId) {
        hoveredDefaultButtonId = null;
      }
      releaseHandDetectionLock(lockOwnerRef.current);
    };
  }, [canDetect, detector, onAction, onDiscard, onIncrease, onDecrease, videoRef, mode, checked]);

  const showHover = !isAnyLoading && !(mode === "checkbox" && checked) && isHovered;
  const showCheckboxIndicator = mode === "checkbox" && checked;

  return (
    <div
      ref={wrapperRef}
      className={[
        "kgm-button",
        className,
        isAnyLoading ? "kgm-button--loading" : "",
        showHover ? "kgm-button--hovered" : "",
        isFocused ? "kgm-button--focused" : "",
        showCheckboxIndicator ? "kgm-button--checked" : "",
        contentAlignX === "center" ? "kgm-button--align-center" : "kgm-button--align-left",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        width: "fit-content",
        minWidth: 200,
        minHeight: useLargeMinimumSize ? 200 : undefined,
        padding: "8px 16px",
        borderRadius: 10,
        ...resolveVisualStyle(),
        color: "white",
        userSelect: "none",
        transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        cursor: isAnyLoading ? "progress" : "pointer",
        boxShadow: showCheckboxIndicator
          ? "0 0 0 2px rgba(88, 214, 141, 0.3), inset 0 0 18px rgba(88, 214, 141, 0.22)"
          : showHover
            ? "var(--kgm-button-hover-glow)"
            : undefined,
        ...style,
      }}
      onClick={onAction}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onAction();
        }
      }}
    >
      {showCheckboxIndicator ? <span className="kgm-button__check">✓</span> : null}
      <span className="kgm-button__content">{children}</span>
    </div>
  );
}
