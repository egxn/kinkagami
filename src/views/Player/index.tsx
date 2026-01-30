import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAllExerciseRecords, ExerciseRecord } from "../../db/dbService";
import { drawRecordedPose } from "../../utils/canvasDrawing";
import type { RecordingAngleEntry } from "../../utils/poseUtils";
import "./Player.scss";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

export default function Player() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ExerciseRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentAngles, setCurrentAngles] = useState<RecordingAngleEntry[]>([]);

  // Load records on mount
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    const allRecords = await getAllExerciseRecords();
    setRecords(allRecords);
  };

  const selectRecord = (record: ExerciseRecord) => {
    if (isPlaying) {
      stopPlayback();
    }
    setSelectedRecord(record);
    setCurrentFrameIndex(0);
    // Draw first frame with angles
    if (record.recording_points.length > 0) {
      const firstFrame = record.recording_points[0];
      const angles = record.recording_angles?.length > 0
        ? record.recording_angles[0]?.angles || []
        : [];
      setCurrentAngles(angles);
      drawFrame(firstFrame.poses, angles);
    }
  };

  const drawFrame = useCallback((poses: ExerciseRecord["recording_points"][0]["poses"], angles: RecordingAngleEntry[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Always draw both skeleton and angles (auto-centered)
    drawRecordedPose(
      ctx,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      poses,
      angles
    );
  }, []);

  const stopPlayback = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (!selectedRecord || selectedRecord.recording_points.length === 0) return;

    setIsPlaying(true);
    const frames = selectedRecord.recording_points;
    const angleFrames = selectedRecord.recording_angles || [];
    
    // Get base timestamp from first frame (in seconds)
    const baseTimestamp = frames[0].timestamp;
    let startIndex = currentFrameIndex;
    
    // If at the end, restart from beginning
    if (startIndex >= frames.length - 1) {
      startIndex = 0;
      setCurrentFrameIndex(0);
    }

    const startFrameTimestamp = frames[startIndex].timestamp;
    // Convert to milliseconds for performance.now() comparison
    const startOffsetMs = (startFrameTimestamp - baseTimestamp) * 1000;
    startTimeRef.current = performance.now() - (startOffsetMs / playbackSpeed);

    const animate = (currentTime: number) => {
      // Calculate elapsed time in seconds
      const elapsedMs = (currentTime - startTimeRef.current) * playbackSpeed;
      const elapsedSeconds = elapsedMs / 1000;
      const targetTimestamp = baseTimestamp + elapsedSeconds;

      // Find the frame closest to the target timestamp
      let frameIndex = 0;
      for (let i = 0; i < frames.length; i++) {
        if (frames[i].timestamp <= targetTimestamp) {
          frameIndex = i;
        } else {
          break;
        }
      }

      // Check if we've reached the end
      if (frameIndex >= frames.length - 1) {
        setCurrentFrameIndex(frames.length - 1);
        const lastAngles = angleFrames[frames.length - 1]?.angles || [];
        setCurrentAngles(lastAngles);
        drawFrame(frames[frames.length - 1].poses, lastAngles);
        stopPlayback();
        return;
      }

      setCurrentFrameIndex(frameIndex);
      const angles = angleFrames[frameIndex]?.angles || [];
      setCurrentAngles(angles);
      drawFrame(frames[frameIndex].poses, angles);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [selectedRecord, currentFrameIndex, playbackSpeed, drawFrame, stopPlayback]);

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    setCurrentFrameIndex(index);

    if (selectedRecord) {
      const frame = selectedRecord.recording_points[index];
      const angles = selectedRecord.recording_angles?.[index]?.angles || [];
      setCurrentAngles(angles);
      if (frame) {
        drawFrame(frame.poses, angles);
      }
    }
  };

  // Redraw current frame when record or frame changes
  useEffect(() => {
    if (selectedRecord && selectedRecord.recording_points[currentFrameIndex]) {
      const frame = selectedRecord.recording_points[currentFrameIndex];
      const angles = selectedRecord.recording_angles?.[currentFrameIndex]?.angles || [];
      drawFrame(frame.poses, angles);
    }
  }, [selectedRecord, currentFrameIndex, drawFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const getDuration = (record: ExerciseRecord) => {
    if (record.recording_points.length < 2) return "0.0";
    const first = record.recording_points[0].timestamp;
    const last = record.recording_points[record.recording_points.length - 1].timestamp;
    // Timestamps are already in seconds
    return (last - first).toFixed(1);
  };

  const getCurrentTime = () => {
    if (!selectedRecord || selectedRecord.recording_points.length === 0) return "0.0";
    const first = selectedRecord.recording_points[0].timestamp;
    const current = selectedRecord.recording_points[currentFrameIndex]?.timestamp || first;
    // Timestamps are already in seconds
    return (current - first).toFixed(1);
  };

  return (
    <div className="player-container">
      <div className="player-header">
        <button className="back-btn" onClick={() => navigate("/menu")}>
          ← Back
        </button>
        <h1>Exercise Player</h1>
      </div>

      <div className="player-content">
        <div className="exercise-list">
          <h3>Recorded Exercises</h3>
          {records.length === 0 ? (
            <div className="no-records">No recordings found</div>
          ) : (
            records.map((record) => (
              <div
                key={record._id}
                className={`exercise-item ${selectedRecord?._id === record._id ? "selected" : ""}`}
                onClick={() => selectRecord(record)}
              >
                <span className="exercise-name">{record.name}</span>
                <span className="exercise-info">
                  {record.recording_points.length} frames • {getDuration(record)}s
                </span>
              </div>
            ))
          )}
        </div>

        <div className="playback-area">
          <div className="canvas-wrapper">
            {selectedRecord ? (
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
              />
            ) : (
              <span className="no-selection">Select an exercise to play</span>
            )}
          </div>

          <div className="playback-controls">
            <button
              className="play-btn"
              onClick={togglePlayback}
              disabled={!selectedRecord}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>

            <div className="speed-control">
              <label>Speed:</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            <div className="progress-bar">
              <input
                type="range"
                min={0}
                max={selectedRecord ? selectedRecord.recording_points.length - 1 : 0}
                value={currentFrameIndex}
                onChange={handleSliderChange}
                disabled={!selectedRecord}
              />
              <span className="time-display">
                {getCurrentTime()}s / {selectedRecord ? getDuration(selectedRecord) : 0}s
              </span>
            </div>

          </div>

          {currentAngles.length > 0 && (
            <div className="angle-legend">
              <span className="legend-title">Current Angles:</span>
              {currentAngles.map((angle) => (
                <div key={angle.name} className="angle-item">
                  <span className="angle-arc"></span>
                  <span>{angle.name.replace(/_/g, " ")}:</span>
                  <span className="angle-value">{angle.value.toFixed(0)}°</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
