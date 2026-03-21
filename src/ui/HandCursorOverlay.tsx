import { useEffect, useState } from "react";
import "./HandCursorOverlay.scss";

export interface HandCursorState {
  visible: boolean;
  x: number;
  y: number;
  lastEvent: "confirm" | "discard" | null;
  eventSequence: number;
  gestureProgress: number;
}

export interface HandCursorOverlayProps {
  cursor: HandCursorState;
}

export default function HandCursorOverlay({ cursor }: HandCursorOverlayProps) {
  const [pulse, setPulse] = useState<"confirm" | "discard" | null>(null);
  const [lastSeq, setLastSeq] = useState(0);

  useEffect(() => {
    if (cursor.eventSequence !== lastSeq && cursor.lastEvent) {
      setLastSeq(cursor.eventSequence);
      setPulse(cursor.lastEvent);
    }
  }, [cursor.eventSequence, cursor.lastEvent, lastSeq]);

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
