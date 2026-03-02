import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { useHandPose } from "../hooks";
import {
  registerButton,
  unregisterButton,
  updateDetectionConfig,
} from "../services/handDetectionLoop";
import "./Button.scss";

interface ButtonProps {
  children: React.ReactNode;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamReady: boolean;
  onAction: () => void;
  onDiscard: () => void;
  requireSecondFistForAction?: boolean;
  onIncrease?: () => void;
  onDecrease?: () => void;
  className?: string;
  style?: CSSProperties;
  alignX?: "auto" | "left" | "center";
  mode?: "default" | "checkbox";
  checked?: boolean;
}

let buttonIdCounter = 0;
const ROUTE_BUTTON_LOCK_MS = 1000;
let globalRouteLockedUntil = 0;
let lastKnownRoutePathname: string | null = null;

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

export default function Button({
  children,
  videoRef,
  streamReady,
  onAction,
  onDiscard,
  requireSecondFistForAction = false,
  onIncrease,
  onDecrease,
  className,
  style,
  alignX = "auto",
  mode = "default",
  checked = false,
}: ButtonProps) {
  const location = useLocation();
  const { detector, isLoading, error } = useHandPose();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonIdRef = useRef<number>(++buttonIdCounter);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Stable callback refs to avoid re-registration on every render
  const onActionRef = useRef(onAction);
  const onDiscardRef = useRef(onDiscard);
  const onIncreaseRef = useRef(onIncrease);
  const onDecreaseRef = useRef(onDecrease);
  const isAnyLoadingRef = useRef(false);
  onActionRef.current = onAction;
  onDiscardRef.current = onDiscard;
  onIncreaseRef.current = onIncrease;
  onDecreaseRef.current = onDecrease;

  const canDetect = useMemo(
    () => !!detector && !isLoading && !error && streamReady,
    [detector, isLoading, error, streamReady],
  );

  // Push detection dependencies to centralized loop
  useEffect(() => {
    updateDetectionConfig(
      canDetect ? videoRef.current : null,
      canDetect ? detector : null,
      canDetect,
    );
  }, [canDetect, detector, videoRef]);

  // Register/unregister with centralized detection loop
  useEffect(() => {
    const id = buttonIdRef.current;

    registerButton({
      id,
      getElement: () => wrapperRef.current,
      mode,
      checked,
      requireSecondFistForAction,
      onHoverChange: setIsHovered,
      onFocusChange: setIsFocused,
      onAction: () => {
        if (isAnyLoadingRef.current) return;
        if (Date.now() < globalRouteLockedUntil) return;
        onActionRef.current();
      },
      onDiscard: () => onDiscardRef.current(),
      onIncrease: () => onIncreaseRef.current?.(),
      onDecrease: () => onDecreaseRef.current?.(),
    });

    return () => unregisterButton(id);
  }, [mode, checked, requireSecondFistForAction]);

  const isCameraLoading = !streamReady;
  const isModelLoading = isLoading;
  const isAnyLoading = isCameraLoading || isModelLoading;
  isAnyLoadingRef.current = isAnyLoading;

  useEffect(() => {
    const pathname = location.pathname;

    if (lastKnownRoutePathname === null) {
      lastKnownRoutePathname = pathname;
      return;
    }

    if (pathname !== lastKnownRoutePathname) {
      lastKnownRoutePathname = pathname;
      globalRouteLockedUntil = Date.now() + ROUTE_BUTTON_LOCK_MS;
    }
  }, [location.pathname]);

  const canTriggerAction = () => {
    if (isAnyLoadingRef.current) return false;
    if (Date.now() < globalRouteLockedUntil) return false;
    return true;
  };

  const triggerAction = () => {
    if (!canTriggerAction()) return;
    onActionRef.current();
  };
  const hasChildren = Children.count(children) > 0;
  const hasOnlyTextChildren = useMemo(
    () => isTextOnlyNode(children),
    [children],
  );
  const useLargeMinimumSize = !hasChildren || hasOnlyTextChildren;
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

  const showHover =
    !isAnyLoading && !(mode === "checkbox" && checked) && isHovered;
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
        contentAlignX === "center"
          ? "kgm-button--align-center"
          : "kgm-button--align-left",
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
        transition:
          "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        cursor: isAnyLoading ? "progress" : "pointer",
        boxShadow: showCheckboxIndicator
          ? "0 0 0 2px rgba(88, 214, 141, 0.3), inset 0 0 18px rgba(88, 214, 141, 0.22)"
          : showHover
            ? "var(--kgm-button-hover-glow)"
            : undefined,
        ...style,
      }}
      onClick={triggerAction}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerAction();
        }
      }}
    >
      {showCheckboxIndicator ? (
        <span className="kgm-button__check">✓</span>
      ) : null}
      <span className="kgm-button__content">{children}</span>
    </div>
  );
}
