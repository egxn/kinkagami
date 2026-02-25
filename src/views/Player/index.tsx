import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAllExercises } from "../../db/dbService";
import type { Exercise } from "../../types/exercise";
import type { RecordingAngleEntry } from "../../utils/poseUtils";
import { DebugFSM } from "../../components/DebugFSM";
import Skeleton from "../../components/Skeleton";
import "./Player.scss";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

export default function Player() {
  const navigate = useNavigate();
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const [records, setRecords] = useState<Exercise[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Exercise | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentAngles, setCurrentAngles] = useState<RecordingAngleEntry[]>([]);
  const [showFSMDebug, setShowFSMDebug] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  // Load records on mount
  useEffect(() => {
    const loadRecords = async () => {
      const allRecords = await getAllExercises();
      setRecords(allRecords);
    };
    loadRecords();
  }, []);

  const stopPlayback = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsPlaying(false);
  };

  const selectRecord = (record: Exercise) => {
    if (isPlaying) {
      stopPlayback();
    }
    setSelectedRecord(record);
    setCurrentFrameIndex(0);
    // Initialize angles for first frame
    if (record.recording_points.length > 0) {
      const firstFrame = record.recording_points[0];
      const angles =
        record.recording_angles?.length > 0
          ? record.recording_angles[0]?.angles || []
          : [];
      setCurrentAngles(angles);
      void firstFrame;
    }
  };

  const startPlayback = () => {
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
    // eslint-disable-next-line react-hooks/purity -- performance.now() is only called from event handler
    startTimeRef.current = performance.now() - startOffsetMs / playbackSpeed;

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
        stopPlayback();
        return;
      }

      setCurrentFrameIndex(frameIndex);
      const angles = angleFrames[frameIndex]?.angles || [];
      setCurrentAngles(angles);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

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
      void frame;
    }
  };

  const currentFramePoses =
    selectedRecord?.recording_points?.[currentFrameIndex]?.poses ?? [];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const getDuration = (record: Exercise) => {
    if (record.recording_points.length < 2) return "0.0";
    const first = record.recording_points[0].timestamp;
    const last =
      record.recording_points[record.recording_points.length - 1].timestamp;
    // Timestamps are already in seconds
    return (last - first).toFixed(1);
  };

  const getCurrentTime = () => {
    if (!selectedRecord || selectedRecord.recording_points.length === 0)
      return "0.0";
    const first = selectedRecord.recording_points[0].timestamp;
    const current =
      selectedRecord.recording_points[currentFrameIndex]?.timestamp || first;
    // Timestamps are already in seconds
    return (current - first).toFixed(1);
  };

  return (
    <div className="player-container">
      <div className="player-header">
        <button className="back-btn" onClick={() => navigate("/canvas")}>
          ← Back
        </button>
        <h1>Exercise Player</h1>
      </div>

      <div className="player-content">
        <div className={`exercise-list ${isListCollapsed ? "collapsed" : ""}`}>
          <button
            className="collapse-toggle"
            onClick={() => setIsListCollapsed(!isListCollapsed)}
            title={isListCollapsed ? "Expand list" : "Collapse list"}
          >
            {isListCollapsed ? "▶" : "◀"}
          </button>
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
                  {record.recording_points.length} frames •{" "}
                  {getDuration(record)}s
                </span>
              </div>
            ))
          )}
        </div>

        <div className="playback-area">
          <div className="canvas-wrapper">
            {selectedRecord ? (
              <>
                <Skeleton
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  poses={currentFramePoses}
                  angles={currentAngles}
                  opacity={1}
                  colors={{ skeleton: "lime", keypoints: "red" }}
                />
                {currentAngles.length > 0 && (
                  <div className="angles-overlay">
                    <div className="angles-left">
                      {currentAngles
                        .filter((a) => a.name.toLowerCase().includes("left"))
                        .map((angle) => (
                          <div key={angle.name} className="angle-item">
                            <span className="angle-name">
                              {angle.name.replace(/_/g, " ").replace("left ", "")}
                            </span>
                            <span className="angle-value">{angle.value.toFixed(0)}°</span>
                          </div>
                        ))}
                    </div>
                    <div className="angles-right">
                      {currentAngles
                        .filter((a) => a.name.toLowerCase().includes("right"))
                        .map((angle) => (
                          <div key={angle.name} className="angle-item">
                            <span className="angle-name">
                              {angle.name.replace(/_/g, " ").replace("right ", "")}
                            </span>
                            <span className="angle-value">{angle.value.toFixed(0)}°</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
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
                max={
                  selectedRecord
                    ? selectedRecord.recording_points.length - 1
                    : 0
                }
                value={currentFrameIndex}
                onChange={handleSliderChange}
                disabled={!selectedRecord}
              />
              <span className="time-display">
                {getCurrentTime()}s /{" "}
                {selectedRecord ? getDuration(selectedRecord) : 0}s
              </span>
            </div>
          </div>

          {selectedRecord?.event_graph && selectedRecord?.completion && (
            <div className="fsm-debug-section">
              <button
                className="toggle-fsm-btn"
                onClick={() => setShowFSMDebug(!showFSMDebug)}
              >
                {showFSMDebug ? "Hide" : "Show"} FSM Debug
              </button>
              {showFSMDebug && (
                <DebugFSM
                  exercise={selectedRecord}
                  isPlaying={isPlaying}
                  progress={
                    selectedRecord.recording_points.length > 1
                      ? currentFrameIndex / (selectedRecord.recording_points.length - 1)
                      : 0
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
