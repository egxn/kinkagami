import { useState, useEffect, useRef, useCallback } from "react";
import "./VideoRangeSlider.scss";

interface VideoRangeSliderProps {
  duration: number;
  startTime: number;
  endTime: number;
  onChange: (start: number, end: number) => void;
  disabled?: boolean;
}

export default function VideoRangeSlider({
  duration,
  startTime,
  endTime,
  onChange,
  disabled = false,
}: VideoRangeSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);

  // Helper to format time
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${min}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const getPercentage = (time: number) => {
    if (duration <= 0) return 0;
    return Math.min(100, Math.max(0, (time / duration) * 100));
  };

  const handleDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || disabled || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

      let percentage = (clientX - rect.left) / rect.width;
      percentage = Math.max(0, Math.min(1, percentage));

      const newTime = percentage * duration;

      // Small buffer to prevent handles from crossing or overlapping too much
      const minDuration = 0.1; // 100ms minimum

      if (isDragging === "start") {
        const limitedTime = Math.min(newTime, endTime - minDuration);
        onChange(Math.max(0, limitedTime), endTime);
      } else {
        const limitedTime = Math.max(newTime, startTime + minDuration);
        onChange(startTime, Math.min(duration, limitedTime));
      }
    },
    [isDragging, duration, startTime, endTime, onChange, disabled],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDrag);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDrag);
      window.addEventListener("touchend", handleDragEnd);
    } else {
      window.removeEventListener("mousemove", handleDrag);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDrag);
      window.removeEventListener("touchend", handleDragEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleDrag);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDrag);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  // Handle click on track to jump closest handle?
  // For now, let's keep it simple: only dragging handles works.

  const startPercent = getPercentage(startTime);
  const endPercent = getPercentage(endTime);

  return (
    <div
      className={`video-range-slider ${disabled ? "disabled" : ""}`}
      ref={containerRef}
    >
      <div className="slider-track-background" />
      <div
        className="slider-track-active"
        style={{
          left: `${startPercent}%`,
          width: `${endPercent - startPercent}%`,
        }}
      />

      {/* Start Handle */}
      <div
        className="slider-handle"
        style={{ left: `${startPercent}%` }}
        onMouseDown={() => setIsDragging("start")}
        onTouchStart={() => setIsDragging("start")}
        data-time={formatTime(startTime)}
      />

      {/* End Handle */}
      <div
        className="slider-handle"
        style={{ left: `${endPercent}%` }}
        onMouseDown={() => setIsDragging("end")}
        onTouchStart={() => setIsDragging("end")}
        data-time={formatTime(endTime)}
      />
    </div>
  );
}
