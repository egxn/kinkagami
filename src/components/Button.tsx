import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { useHandPose } from "../hooks";
import {
  registerButton,
  unregisterButton,
  updateDetectionConfig,
} from "../services/handDetectionLoop";
import { Button as ButtonUI } from "../ui";

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

  useEffect(() => {
    updateDetectionConfig(
      canDetect ? videoRef.current : null,
      canDetect ? detector : null,
      canDetect,
    );
  }, [canDetect, detector, videoRef]);

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

  const triggerAction = () => {
    if (isAnyLoadingRef.current) return;
    if (Date.now() < globalRouteLockedUntil) return;
    onActionRef.current();
  };

  return (
    <ButtonUI
      ref={wrapperRef}
      className={className}
      style={style}
      alignX={alignX}
      mode={mode}
      checked={checked}
      isHovered={isHovered}
      isFocused={isFocused}
      isCameraLoading={isCameraLoading}
      isModelLoading={isModelLoading}
      onClick={triggerAction}
    >
      {children}
    </ButtonUI>
  );
}
