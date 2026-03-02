import React, { act, useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { usePoseDetection } from "../hooks/usePoseDetection";

interface ProbeProps {
  detector: { estimatePoses: (video: HTMLVideoElement) => Promise<unknown[]> } | null;
  modelLoading: boolean;
  streamReady: boolean;
  onPosesDetected: (poses: unknown[]) => void;
}

function Probe({ detector, modelLoading, streamReady, onPosesDetected }: ProbeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
    Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
    videoRef.current = video;
  }, []);

  usePoseDetection({
    detector: detector as never,
    videoRef,
    modelLoading,
    streamReady,
    onPosesDetected: onPosesDetected as never,
  });

  return <div>probe</div>;
}

describe("usePoseDetection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (root) {
      await act(async () => {
        root.unmount();
      });
    }

    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("does not start detection when stream is not ready", async () => {
    const estimatePoses = vi.fn(async () => []);
    const onPosesDetected = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          detector={{ estimatePoses }}
          modelLoading={false}
          streamReady={false}
          onPosesDetected={onPosesDetected}
        />,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(120);
    });

    expect(estimatePoses).not.toHaveBeenCalled();
    expect(onPosesDetected).not.toHaveBeenCalled();
  });

  it("estimates poses and emits callback when detector returns data", async () => {
    const poses = [{ score: 0.9, keypoints: [{ x: 1, y: 2, score: 0.8 }] }];
    const estimatePoses = vi.fn(async () => poses);
    const onPosesDetected = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          detector={{ estimatePoses }}
          modelLoading={false}
          streamReady={true}
          onPosesDetected={onPosesDetected}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });

    expect(estimatePoses).toHaveBeenCalled();
    expect(onPosesDetected).toHaveBeenCalledWith(poses);
  });
});
