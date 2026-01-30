import { useState, useRef, useContext, useEffect } from "react";
import PoseContext from "../../context/PoseContext";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { drawPosesOnCanvas } from "../../utils/canvasDrawing";
import { calculateAllBodyAngles } from "../../utils/poseUtils";
import { addExerciseRecord } from "../../db/dbService";
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

  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev]);
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

    // Check if current frame is within the configured time range
    if (metadata.mediaTime < timeRange[0] || metadata.mediaTime > timeRange[1]) {
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

          // Check if current time is within range
          if (
            videoRef.current.currentTime < timeRange[0] ||
            videoRef.current.currentTime > timeRange[1]
          ) {
            if (videoRef.current.currentTime > timeRange[1]) {
              // Stop if we've passed the end time
              videoRef.current.pause();
              return;
            }
            // Skip to next frame if before start time
            if (!videoRef.current.paused)
              requestAnimationFrame(fallbackLoop);
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
      setIsProcessing(false);
    }
  };

  // Stop when video ends
  const onVideoEnded = () => {
    setIsProcessing(false);
    const processedDuration = timeRange[1] - timeRange[0];
    addLog(
      `Processing finished. Captured ${capturedData.length} valid frames.`,
    );
    addLog(
      `Processed range: ${timeRange[0].toFixed(2)}s - ${timeRange[1].toFixed(2)}s (${processedDuration.toFixed(2)}s)`,
    );
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
        (frame) => frame.timestamp >= timeRange[0] && frame.timestamp <= timeRange[1]
      );

      // Generate recording_angles: calculate body angles for each frame
      const recordingAngles = filteredData.map((frame) => {
        // Calculate angles for the first pose (primary person)
        const angles = frame.poses.length > 0 
          ? calculateAllBodyAngles(frame.poses[0])
          : [];
        
        return {
          timestamp: frame.timestamp,
          angles,
        };
      });

      addLog(`Generated angles for ${recordingAngles.length} frames`);

      const recordData = {
        exercise_id: metadata.exercise_id,
        name: metadata.name,
        description: metadata.description,
        muscle_groups: metadata.muscle_groups.split(",").map((s) => s.trim()),
        difficulty: metadata.difficulty,
        instructions: metadata.instructions.filter((i) => i.trim() !== ""),
        recording_points: filteredData,
        recording_angles: recordingAngles,
        created_at: new Date().toISOString(),
      };

      const result = await addExerciseRecord(recordData);
      
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
      <h1>{t("create.title")}</h1>

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
              {isSaving ? t("button.saving") : t("button.save")} ({capturedData.length})
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
