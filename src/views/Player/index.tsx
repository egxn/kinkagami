import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { deleteExercise, getAllExercises } from "../../db/dbService";
import type { Exercise } from "../../types/exercise";
import { calculateAllBodyAngles, type RecordingAngleEntry } from "../../utils/poseUtils";
import { DebugFSM } from "../../components/DebugFSM";
import Skeleton from "../../components/Skeleton";
import "./Player.scss";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

type PlaybackSource = "recording_points" | "tutor_points";

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
  const [showDbExerciseData, setShowDbExerciseData] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [playbackSource, setPlaybackSource] =
    useState<PlaybackSource>("recording_points");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRecords = async () => {
    const allRecords = await getAllExercises();
    setRecords(allRecords);
  };

  const activeFrames = useMemo(() => {
    if (!selectedRecord) return [];
    if (playbackSource === "tutor_points") {
      return selectedRecord.tutor_points ?? [];
    }
    return selectedRecord.recording_points ?? [];
  }, [selectedRecord, playbackSource]);

  const activeModel = playbackSource === "tutor_points" ? "blazepose" : "movenet";

  const activeAnglesFrames = useMemo<RecordingAngleEntry[][]>(() => {
    if (!selectedRecord) return [];

    if (
      playbackSource === "recording_points" &&
      selectedRecord.recording_angles.length > 0
    ) {
      return selectedRecord.recording_angles.map((frame) => frame.angles ?? []);
    }

    return activeFrames.map((frame) => {
      const firstPose = frame.poses?.[0];
      if (!firstPose) return [];
      return calculateAllBodyAngles(
        firstPose,
        playbackSource === "tutor_points" ? 0.1 : 0.3,
      );
    });
  }, [selectedRecord, playbackSource, activeFrames]);

  // Load records on mount
  useEffect(() => {
    void loadRecords();
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
    const hasRecording = (record.recording_points?.length ?? 0) > 0;
    const hasTutor = (record.tutor_points?.length ?? 0) > 0;

    if (!hasRecording && hasTutor) {
      setPlaybackSource("tutor_points");
    } else {
      setPlaybackSource("recording_points");
    }
    setCurrentFrameIndex(0);
  };

  useEffect(() => {
    if (!selectedRecord) {
      setCurrentAngles([]);
      return;
    }

    const angles = activeAnglesFrames[currentFrameIndex] ?? [];
    setCurrentAngles(angles);
  }, [selectedRecord, currentFrameIndex, activeAnglesFrames]);

  useEffect(() => {
    setCurrentFrameIndex(0);
    if (isPlaying) {
      stopPlayback();
    }
  }, [playbackSource]);

  const startPlayback = () => {
    if (!selectedRecord || activeFrames.length === 0) return;

    setIsPlaying(true);
    const frames = activeFrames;
    const angleFrames = activeAnglesFrames;

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
        const lastAngles = angleFrames[frames.length - 1] || [];
        setCurrentAngles(lastAngles);
        stopPlayback();
        return;
      }

      setCurrentFrameIndex(frameIndex);
      const frameAngles = angleFrames[frameIndex];
      setCurrentAngles(Array.isArray(frameAngles) ? frameAngles : []);

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
  };

  const currentFramePoses =
    activeFrames[currentFrameIndex]?.poses ?? [];

  const fsmProgress = useMemo(() => {
    if (activeFrames.length < 2) return 0;
    const firstTs = activeFrames[0].timestamp;
    const lastTs = activeFrames[activeFrames.length - 1].timestamp;
    const currentTs = activeFrames[currentFrameIndex]?.timestamp ?? firstTs;
    const span = lastTs - firstTs;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(1, (currentTs - firstTs) / span));
  }, [activeFrames, currentFrameIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const getDuration = (record: Exercise) => {
    const frames =
      playbackSource === "tutor_points"
        ? (record.tutor_points ?? [])
        : record.recording_points;
    if (frames.length < 2) return "0.0";
    const first = frames[0].timestamp;
    const last = frames[frames.length - 1].timestamp;
    // Timestamps are already in seconds
    return (last - first).toFixed(1);
  };

  const getCurrentTime = () => {
    if (!selectedRecord || activeFrames.length === 0)
      return "0.0";
    const first = activeFrames[0].timestamp;
    const current = activeFrames[currentFrameIndex]?.timestamp || first;
    // Timestamps are already in seconds
    return (current - first).toFixed(1);
  };

  const handleDeleteSelected = async () => {
    if (!selectedRecord?._id || isDeleting) return;

    const accepted = window.confirm(
      `¿Eliminar ejercicio "${selectedRecord.name || selectedRecord._id}"?`,
    );
    if (!accepted) return;

    try {
      setIsDeleting(true);
      stopPlayback();
      await deleteExercise(selectedRecord._id);
      setSelectedRecord(null);
      setCurrentFrameIndex(0);
      setCurrentAngles([]);
      await loadRecords();
    } catch (error) {
      console.error("Error deleting exercise:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="player-container">
      <div className="player-header">
        <button className="back-btn" onClick={() => navigate("/canvas")}>
          ← Back
        </button>
        <h1>Exercise Player</h1>
      </div>

      <div className="player-content player-content--vertical">
        <div className={`exercise-list exercise-list--floating ${isListCollapsed ? "collapsed" : ""}`}>
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
                  rec: {record.recording_points.length} • tutor: {record.tutor_points?.length ?? 0} •{" "}
                  {getDuration(record)}s
                </span>
              </div>
            ))
          )}
        </div>

        <div className="player-top-row">
          <div className="playback-area playback-area--skeleton">
            <div className="canvas-wrapper">
              {selectedRecord ? (
                <>
                  <Skeleton
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    poses={currentFramePoses}
                    angles={currentAngles}
                    opacity={1}
                    poseModel={activeModel}
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
          </div>

          <div className="playback-area playback-area--fsm">
            {selectedRecord?.event_graph && selectedRecord?.completion ? (
              <div className="fsm-debug-section fsm-debug-section--full">
                <button
                  className="toggle-fsm-btn"
                  onClick={() => setShowFSMDebug(!showFSMDebug)}
                >
                  {showFSMDebug ? "Hide" : "Show"} FSM Debug
                </button>
                {showFSMDebug ? (
                  <DebugFSM
                    exercise={selectedRecord}
                    isPlaying={isPlaying}
                    progress={fsmProgress}
                  />
                ) : (
                  <div className="fsm-placeholder">FSM oculto</div>
                )}
              </div>
            ) : (
              <span className="no-selection">Select an exercise with FSM data</span>
            )}
          </div>
        </div>

        <div className="player-bottom-controls">
          <div className="playback-controls playback-controls--actions">
            <div className="controls-actions-left">
              <button
                className="play-btn"
                onClick={togglePlayback}
                disabled={!selectedRecord}
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>

              <button
                className="delete-btn"
                onClick={() => {
                  void handleDeleteSelected();
                }}
                disabled={!selectedRecord?._id || isDeleting}
              >
                {isDeleting ? "Eliminando..." : "🗑 Eliminar"}
              </button>
            </div>

            <div className="controls-actions-right">
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

              <div className="source-control">
                <label>Source:</label>
                <select
                  value={playbackSource}
                  onChange={(e) => setPlaybackSource(e.target.value as PlaybackSource)}
                  disabled={
                    !selectedRecord ||
                    ((selectedRecord.recording_points?.length ?? 0) === 0 &&
                      (selectedRecord.tutor_points?.length ?? 0) === 0)
                  }
                >
                  <option
                    value="recording_points"
                    disabled={(selectedRecord?.recording_points?.length ?? 0) === 0}
                  >
                    MoveNet (recording_points)
                  </option>
                  <option
                    value="tutor_points"
                    disabled={(selectedRecord?.tutor_points?.length ?? 0) === 0}
                  >
                    BlazePose (tutor_points)
                  </option>
                </select>
              </div>

              <button
                className="db-data-btn"
                onClick={() => setShowDbExerciseData((prev) => !prev)}
                disabled={!selectedRecord}
              >
                {showDbExerciseData ? "Ocultar DB" : "Ver ejercicio DB"}
              </button>
            </div>
          </div>

          <div className="playback-controls playback-controls--timeline">
            <div className="progress-bar">
              <input
                type="range"
                min={0}
                max={
                  selectedRecord && activeFrames.length > 0
                    ? activeFrames.length - 1
                    : 0
                }
                value={currentFrameIndex}
                onChange={handleSliderChange}
                disabled={!selectedRecord || activeFrames.length === 0}
              />
              <span className="time-display">
                {getCurrentTime()}s /{" "}
                {selectedRecord ? getDuration(selectedRecord) : 0}s
              </span>
            </div>
          </div>

          {showDbExerciseData && selectedRecord && (
            <div className="db-data-panel">
              <div className="db-data-panel__header">Ejercicio desde DB</div>
              <pre>{JSON.stringify(selectedRecord, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
