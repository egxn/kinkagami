import { useEffect, useRef, useState } from "react";
import {
  subscribeHandCursor,
  type HandCursorState,
} from "../services/handDetectionLoop";
import "./HandCursorOverlay.scss";

const EMPTY_CURSOR: HandCursorState = {
  visible: false,
  x: 0,
  y: 0,
  lastEvent: null,
  eventSequence: 0,
  gestureProgress: 0,
};

export default function HandCursorOverlay() {
  const [cursor, setCursor] = useState<HandCursorState>(EMPTY_CURSOR);
  const [pulse, setPulse] = useState<"confirm" | "discard" | null>(null);
  const lastEventSequenceRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeHandCursor((next) => {
      setCursor(next);

      if (
        next.eventSequence !== lastEventSequenceRef.current &&
        next.lastEvent
      ) {
        lastEventSequenceRef.current = next.eventSequence;
        setPulse(next.lastEvent);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => {
      setPulse(null);
    }, 320);

    return () => clearTimeout(timer);
  }, [pulse]);

  const isVisible = cursor.visible;

  return (
    <div
      className={[
        "hand-cursor-overlay",
        isVisible ? "hand-cursor-overlay--visible" : "",
        pulse ? `hand-cursor-overlay--${pulse}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`,
        "--gesture-progress": cursor.gestureProgress,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="hand-cursor-overlay__ring" />
      <div className="hand-cursor-overlay__progress-ring" />
      <div className="hand-cursor-overlay__dot" />
    </div>
  );
}
