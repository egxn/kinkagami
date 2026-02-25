import { useState, useRef, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PoseContext from "../../context/PoseContext";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { drawPosesOnCanvas } from "../../utils/canvasDrawing";
import { calculateAllBodyAngles } from "../../utils/poseUtils";
import { addExercise } from "../../db/dbService";
import { generateEventGraph } from "../../services/exerciseGenerator";
import { useTranslation } from "react-i18next";
import VideoRangeSlider from "../../components/VideoRangeSlider";
import VideoSelector from "../../components/VideoSelector";
import "./Create.scss";

// Define structure for the captured data
interface CapturedFrame {
  timestamp: number;
  poses: poseDetection.Pose[];
}

interface ExerciseMetadata {
  exercise_id: string;
  name: string;
  description: string;
  muscle_groups: string;
  difficulty: string;
  instructions: string[];
}

export default function Create() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { detector } = useContext(PoseContext) || {};

  // State
  const [videoUrl, setVideoUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [capturedData, setCapturedData] = useState<CapturedFrame[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [videoDuration, setVideoDuration] = useState(0);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 0]);

  // Form State
  const [metadata, setMetadata] = useState<ExerciseMetadata>({
    exercise_id: "",
    name: "",
    description: "",
    muscle_groups: "",
    difficulty: "beginner",
    instructions: [""],
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(undefined);
  const previewRequestRef = useRef<number>(undefined);
  const isProcessingRef = useRef(false);
  const timeRangeRef = useRef<[number, number]>([0, 0]);

  // Keep timeRangeRef in sync
  useEffect(() => {
    timeRangeRef.current = timeRange;
  }, [timeRange]);

  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev]);
  };

  // Preview skeleton detection (runs when video is paused/loaded)
  const detectAndDrawPreview = async () => {
    if (!videoRef.current || !detector || !canvasRef.current || isProcessingRef.current) return;
    
    try {
      const poses = await detector.estimatePoses(videoRef.current);
      
      // Ensure canvas matches video dims
      if (canvasRef.current.width !== videoRef.current.videoWidth) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }
      
      drawPosesOnCanvas(canvasRef.current, videoRef.current, poses);
    } catch (err) {
      console.error("Preview detection error:", err);
    }
  };

  // Preview loop during normal video playback (not processing)
  const startPreviewPlayback = () => {
    if (isProcessingRef.current) return;
    
    const previewLoop = async () => {
      if (!videoRef.current || !detector || !canvasRef.current) return;
      if (videoRef.current.paused || videoRef.current.ended) return;
      if (isProcessingRef.current) return;
      
      try {
        const poses = await detector.estimatePoses(videoRef.current);
        
        if (canvasRef.current.width !== videoRef.current.videoWidth) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
        
        drawPosesOnCanvas(canvasRef.current, videoRef.current, poses);
      } catch (err) {
        console.error("Preview playback error:", err);
      }
      
      // Continue loop if still playing and not processing
      if (!videoRef.current.paused && !videoRef.current.ended && !isProcessingRef.current) {
        previewRequestRef.current = requestAnimationFrame(previewLoop);
      }
    };
    
    previewLoop();
  };

  const stopPreviewPlayback = () => {
    if (previewRequestRef.current) {
      cancelAnimationFrame(previewRequestRef.current);
      previewRequestRef.current = undefined;
    }
  };

  const handleLoad = () => {
    if (inputUrl) {
      setVideoUrl(inputUrl);
      setCapturedData([]);
      setVideoDuration(0);
      setTimeRange([0, 0]);
      addLog(`Loaded video: ${inputUrl}`);
    }
  };

  // Metadata handlers
  const handleMetadataChange = (
    field: keyof ExerciseMetadata,
    value: string,
  ) => {
    setMetadata((prev) => ({ ...prev, [field]: value }));
  };

  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...metadata.instructions];
    newInstructions[index] = value;
    setMetadata((prev) => ({ ...prev, instructions: newInstructions }));
  };

  const addInstruction = () => {
    setMetadata((prev) => ({
      ...prev,
      instructions: [...prev.instructions, ""],
    }));
  };

  const removeInstruction = (index: number) => {
    setMetadata((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  // Video metadata handler
  const handleVideoMetadataLoaded = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      setTimeRange([0, duration]);
      addLog(`Video duration: ${duration.toFixed(2)}s`);
    }
  };

  // Handler for when video data is loaded - detect skeleton on first frame
  const handleVideoDataLoaded = async () => {
    if (videoRef.current && detector) {
      addLog("Video loaded, detecting skeleton preview...");
      // Small delay to ensure video frame is ready
      setTimeout(() => {
        detectAndDrawPreview();
      }, 100);
    }
  };

  // Handler for seeking - update skeleton preview
  const handleVideoSeeked = () => {
    if (!isProcessingRef.current) {
      detectAndDrawPreview();
    }
  };

  // Handler for video pause - draw preview
  const handleVideoPause = () => {
    stopPreviewPlayback();
    if (!isProcessingRef.current) {
      detectAndDrawPreview();
    }
  };

  // Handler for video play - start preview loop (only if not processing)
  const handleVideoPlay = () => {
    if (!isProcessingRef.current) {
      startPreviewPlayback();
    }
  };

  // Validation
  const isFormValid = () => {
    return (
      metadata.exercise_id.trim() !== "" &&
      metadata.name.trim() !== "" &&
      metadata.description.trim() !== "" &&
      metadata.muscle_groups.trim() !== "" &&
      capturedData.length > 0
    );
  };

  // Canvas Resizing
  useEffect(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const handleResize = () => {
        if (video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          // Force a redraw just in case?
        }
      };

      video.addEventListener("loadedmetadata", handleResize);
      return () => video.removeEventListener("loadedmetadata", handleResize);
    }
  }, [videoUrl]);

  // Start preview when detector becomes available and video is loaded
  useEffect(() => {
    if (detector && videoUrl && videoRef.current && !isProcessingRef.current) {
      // Give time for video to be ready
      const timeout = setTimeout(() => {
        detectAndDrawPreview();
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [detector, videoUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreviewPlayback();
    };
  }, []);

  // Video processing loop
  const processFrame = async (
    _now: number,
    metadata: VideoFrameCallbackMetadata,
  ) => {
    if (
      !videoRef.current ||
      !detector ||
      videoRef.current.paused ||
      videoRef.current.ended
    ) {
      return;
    }

    // Check if current frame is within the configured time range (use ref for current value)
    const [startTime, endTime] = timeRangeRef.current;
    if (
      metadata.mediaTime < startTime ||
      metadata.mediaTime > endTime
    ) {
      requestRef.current =
        videoRef.current.requestVideoFrameCallback(processFrame);
      return;
    }

    try {
      const poses = await detector.estimatePoses(videoRef.current);

      // Filter: Only proceed if poses detected
      if (poses.length > 0) {
        setCapturedData((prev) => [
          ...prev,
          {
            timestamp: metadata.mediaTime,
            poses,
          },
        ]);
      }

      // Draw on canvas
      if (canvasRef.current) {
        // Ensure canvas matches video dims
        // (Optimally this should be done once but ensures sync)
        if (canvasRef.current.width !== videoRef.current.videoWidth) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }

        drawPosesOnCanvas(canvasRef.current, videoRef.current, poses);
      }

      // Continue loop
      requestRef.current =
        videoRef.current.requestVideoFrameCallback(processFrame);
    } catch (err) {
      console.error(err);
      addLog(`Error processing frame: ${err}`);
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const startProcessing = async () => {
    if (!videoRef.current || !detector) {
      addLog("Video or Detector not ready");
      return;
    }

    addLog("Starting processing...");
    addLog(
      `Time range: ${timeRange[0].toFixed(2)}s - ${timeRange[1].toFixed(2)}s`,
    );
    
    // Stop preview playback if running
    stopPreviewPlayback();
    
    isProcessingRef.current = true;
    setIsProcessing(true);
    setCapturedData([]);

    // Set video to start of time range
    videoRef.current.currentTime = timeRange[0];

    // Play and start loop
    try {
      await videoRef.current.play();

      if ("requestVideoFrameCallback" in videoRef.current) {
        requestRef.current =
          videoRef.current.requestVideoFrameCallback(processFrame);
      } else {
        // Fallback for browsers without rVFC
        addLog("Fallback loop (no rVFC)");
        const fallbackLoop = async () => {
          if (
            !videoRef.current ||
            videoRef.current.paused ||
            videoRef.current.ended
          )
            return;

          // Check if current time is within range (use ref for current value)
          const [startTime, endTime] = timeRangeRef.current;
          if (
            videoRef.current.currentTime < startTime ||
            videoRef.current.currentTime > endTime
          ) {
            if (videoRef.current.currentTime > endTime) {
              // Stop if we've passed the end time
              videoRef.current.pause();
              return;
            }
            // Skip to next frame if before start time
            if (!videoRef.current.paused) requestAnimationFrame(fallbackLoop);
            return;
          }

          const poses = await detector.estimatePoses(videoRef.current);

          if (poses.length > 0) {
            setCapturedData((prev) => [
              ...prev,
              { timestamp: videoRef.current!.currentTime, poses },
            ]);
          }

          if (canvasRef.current) {
            drawPosesOnCanvas(canvasRef.current, videoRef.current, poses);
          }

          if (!videoRef.current.paused) requestAnimationFrame(fallbackLoop);
        };
        fallbackLoop();
      }
    } catch (e) {
      addLog(`Error starting playback: ${e}`);
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Stop when video ends
  const onVideoEnded = () => {
    // Stop preview playback
    stopPreviewPlayback();
    
    // Only log processing results if we were actually processing
    if (isProcessingRef.current) {
      isProcessingRef.current = false;
      setIsProcessing(false);
      const processedDuration = timeRange[1] - timeRange[0];
      addLog(
        `Processing finished. Captured ${capturedData.length} valid frames.`,
      );
      addLog(
        `Processed range: ${timeRange[0].toFixed(2)}s - ${timeRange[1].toFixed(2)}s (${processedDuration.toFixed(2)}s)`,
      );
    }
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      addLog(t("create.log.fill_form"));
      return;
    }

    setIsSaving(true);
    addLog("Saving to database...");

    try {
      // Filter captured data based on time range
      const filteredData = capturedData.filter(
        (frame) =>
          frame.timestamp >= timeRange[0] && frame.timestamp <= timeRange[1],
      );

      // Generate recording_angles: calculate body angles for each frame
      const recordingAngles = filteredData.map((frame) => {
        // Calculate angles for the first pose (primary person)
        const angles =
          frame.poses.length > 0 ? calculateAllBodyAngles(frame.poses[0]) : [];

        return {
          timestamp: frame.timestamp,
          angles,
        };
      });

      addLog(`Generated angles for ${recordingAngles.length} frames`);

      // Generate event graph from recorded angles
      const { signals, eventGraph, timeConstraints, completion } =
        generateEventGraph(recordingAngles);

      addLog(
        `Generated event graph: ${eventGraph.nodes.length} nodes, ${eventGraph.edges.length} edges`,
      );
      addLog(`Detected ${Object.keys(signals).length} active signals: ${Object.keys(signals).join(", ") || "none"}`);
      addLog(`Time constraints: ${timeConstraints.length}, Terminal nodes: ${completion.terminal_nodes.length}`);

      // Debug: Log the generated data
      console.log("Generated signals:", signals);
      console.log("Generated eventGraph:", eventGraph);
      console.log("Generated timeConstraints:", timeConstraints);
      console.log("Generated completion:", completion);

      const recordData = {
        exercise_id: metadata.exercise_id,
        name: metadata.name,
        description: metadata.description,
        muscle_groups: metadata.muscle_groups.split(",").map((s) => s.trim()),
        difficulty: metadata.difficulty,
        instructions: metadata.instructions.filter((i) => i.trim() !== ""),
        signals,
        event_graph: eventGraph,
        time_constraints: timeConstraints,
        completion,
        recording_points: filteredData,
        recording_angles: recordingAngles,
        created_at: new Date().toISOString(),
      };

      // Debug: Log full record data before saving
      console.log("Record data to save:", recordData);

      const result = await addExercise(recordData);

      if (result.success) {
        addLog(`Saved to database with ID: ${result.id}`);
        addLog(t("create.log.saved"));
      }
    } catch (error) {
      addLog(`Error saving: ${error}`);
      console.error("Error saving to database:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="create-view">
      <div className="create-header">
        <h1>{t("create.title")}</h1>
        <button className="goto-player-btn" onClick={() => navigate("/player")}>
          {t("button.go_to_player") || "Go to Player"} →
        </button>
      </div>

      <div className="main-content">
        <div className="video-section">
          <VideoSelector
            onSelect={(videoPath) => setInputUrl(videoPath)}
            currentUrl={inputUrl}
          />

          <div className="controls">
            <input
              type="text"
              placeholder={t("create.input_placeholder")}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            <button className="load-btn" onClick={handleLoad}>
              {t("button.load")}
            </button>
          </div>

          <div className="video-container">
            {videoUrl && (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls={!isProcessing}
                  onEnded={onVideoEnded}
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onLoadedData={handleVideoDataLoaded}
                  onSeeked={handleVideoSeeked}
                  onPause={handleVideoPause}
                  onPlay={handleVideoPlay}
                  crossOrigin="anonymous"
                  muted
                />
                <canvas ref={canvasRef} />
              </>
            )}
            {isProcessing && (
              <div className="overlay-info">
                {t("create.overlay_processing", { count: capturedData.length })}
              </div>
            )}
          </div>

          {/* Video Range Slider */}
          <VideoRangeSlider
            duration={videoDuration}
            startTime={timeRange[0]}
            endTime={timeRange[1]}
            onChange={(start, end) => setTimeRange([start, end])}
            disabled={!videoUrl || videoDuration === 0}
          />

          <div className="process-controls">
            <button
              className="process-btn"
              onClick={startProcessing}
              disabled={!videoUrl || isProcessing || !detector}
            >
              {isProcessing ? t("button.processing") : t("button.process")}
            </button>

            <button
              className="save-btn"
              onClick={handleSave}
              disabled={capturedData.length === 0 || isProcessing || isSaving}
              title={
                capturedData.length === 0
                  ? "Process a video first to capture data"
                  : !isFormValid()
                    ? t("create.log.fill_form")
                    : t("button.save")
              }
            >
              {isSaving ? t("button.saving") : t("button.save")} (
              {capturedData.length})
            </button>
          </div>
          <div className="status-log">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
            {!detector && <div>{t("create.waiting_model")}</div>}
          </div>
        </div>

        <div className="form-section">
          <h2>{t("create.form.title")}</h2>

          <div className="form-group">
            <label>{t("create.form.id")}</label>
            <input
              type="text"
              placeholder="e.g. squat_01"
              value={metadata.exercise_id}
              onChange={(e) =>
                handleMetadataChange("exercise_id", e.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label>{t("create.form.name")}</label>
            <input
              type="text"
              placeholder="e.g. Bodyweight Squat"
              value={metadata.name}
              onChange={(e) => handleMetadataChange("name", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{t("create.form.description")}</label>
            <textarea
              placeholder="Brief description..."
              value={metadata.description}
              onChange={(e) =>
                handleMetadataChange("description", e.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label>{t("create.form.difficulty")}</label>
            <select
              value={metadata.difficulty}
              onChange={(e) =>
                handleMetadataChange("difficulty", e.target.value)
              }
            >
              <option value="beginner">
                {t("create.difficulty.beginner")}
              </option>
              <option value="intermediate">
                {t("create.difficulty.intermediate")}
              </option>
              <option value="advanced">
                {t("create.difficulty.advanced")}
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>{t("create.form.muscle_groups")}</label>
            <input
              type="text"
              placeholder="e.g. legs, glutes, core"
              value={metadata.muscle_groups}
              onChange={(e) =>
                handleMetadataChange("muscle_groups", e.target.value)
              }
            />
          </div>

          <div className="form-group instructions-list">
            <label>{t("create.form.instructions")}</label>
            {metadata.instructions.map((inst, idx) => (
              <div key={idx} className="instruction-item">
                <input
                  type="text"
                  value={inst}
                  placeholder={t("create.form.step_placeholder", {
                    count: idx + 1,
                  })}
                  onChange={(e) => handleInstructionChange(idx, e.target.value)}
                />
                <button onClick={() => removeInstruction(idx)}>✕</button>
              </div>
            ))}
            <button className="add-step-btn" onClick={addInstruction}>
              {t("button.add_step")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
