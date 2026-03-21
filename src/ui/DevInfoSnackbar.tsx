import { useCallback, useEffect, useRef, useState } from "react";
import "./DevInfoSnackbar.scss";

export interface DevInfoSnackbarProps {
  modelLabel: string;
  cameraLabel: string;
  backendLabel: string;
}

export default function DevInfoSnackbar({
  modelLabel,
  cameraLabel,
  backendLabel,
}: DevInfoSnackbarProps) {
  const [dismissed, setDismissed] = useState(false);
  const [fps, setFps] = useState(0);
  const frameTimesRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let lastTs = performance.now();

    const tick = (ts: number) => {
      const delta = ts - lastTs;
      lastTs = ts;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 30) {
        frameTimesRef.current.shift();
      }

      const avg =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        frameTimesRef.current.length;
      setFps(Math.round(1000 / avg));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  if (dismissed) return null;

  const fpsClass =
    fps >= 20
      ? "dev-snackbar__fps--ok"
      : fps >= 10
        ? "dev-snackbar__fps--warn"
        : "dev-snackbar__fps--bad";

  return (
    <div className="dev-snackbar">
      <span className="dev-snackbar__item">
        <span className="dev-snackbar__label">model</span>
        <span className="dev-snackbar__value">{modelLabel}</span>
      </span>
      <span className="dev-snackbar__sep">·</span>
      <span className="dev-snackbar__item">
        <span className="dev-snackbar__label">cam</span>
        <span className="dev-snackbar__value">{cameraLabel}</span>
      </span>
      <span className="dev-snackbar__sep">·</span>
      <span className="dev-snackbar__item">
        <span className="dev-snackbar__label">backend</span>
        <span className="dev-snackbar__value">{backendLabel}</span>
      </span>
      <span className="dev-snackbar__sep">·</span>
      <span className="dev-snackbar__item">
        <span className="dev-snackbar__label">fps</span>
        <span className={`dev-snackbar__value ${fpsClass}`}>{fps}</span>
      </span>
      <button
        className="dev-snackbar__close"
        onClick={handleDismiss}
        title="Dismiss"
        type="button"
      >
        ×
      </button>
    </div>
  );
}
