import { useEffect, useState } from "react";
import {
  subscribeHandCursor,
  type HandCursorState,
} from "../services/handDetectionLoop";
import { HandCursorOverlay as HandCursorOverlayUI } from "../ui";

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

  useEffect(() => {
    const unsubscribe = subscribeHandCursor((next) => {
      setCursor(next);
    });

    return unsubscribe;
  }, []);

  return <HandCursorOverlayUI cursor={cursor} />;
}
