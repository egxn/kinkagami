import { useState, useRef, useContext, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PoseContext from "../../context/PoseContext";
import * as poseDetection from "@tensorflow-models/pose-detection";
import {
  drawPosesOnCanvas,
  type PoseModelKind,
} from "../../utils/canvasDrawing";
import { calculateAllBodyAngles } from "../../utils/poseUtils";
import { buildGridValidationDefinition } from "../../utils/gridValidation";
import { addExercise } from "../../db/dbService";
import { generateEventGraph } from "../../services/exerciseGenerator";
import { useBlazePose } from "../../inference";
import { useTranslation } from "react-i18next";
import VideoRangeSlider from "../../components/VideoRangeSlider";
import VideoSelector from "../../components/VideoSelector";
import type { PoseEstimator } from "../../types/inference";
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
  const { detector: blazePoseDetector, isLoading: isBlazePoseLoading } =
    useBlazePose();

  // State
  const [videoUrl, setVideoUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [capturedData, setCapturedData] = useState<CapturedFrame[]>([]);
  const [tutorData, setTutorData] = useState<CapturedFrame[]>([]);
  const [processingModel, setProcessingModel] = useState<
    "MoveNet" | "BlazePose" | null
  >(null);
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

  const syncCanvasToVideoDisplay = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return { width: 0, height: 0 };

    const width = Math.max(
      1,
      Math.round(video.clientWidth || video.videoWidth || 1),
    );
    const height = Math.max(
      1,
      Math.round(video.clientHeight || video.videoHeight || 1),
    );
    const dpr = window.devicePixelRatio || 1;

    const backingWidth = Math.max(1, Math.floor(width * dpr));
    const backingHeight = Math.max(1, Math.floor(height * dpr));

    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { width, height };
  }, []);

  const drawCurrentPoses = useCallback(
    (poses: poseDetection.Pose[], poseModel: PoseModelKind) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const { width, height } = syncCanvasToVideoDisplay();
      drawPosesOnCanvas(canvas, video, poses, {
        fitMode: "contain",
        renderWidth: width,
        renderHeight: height,
        poseModel,
      });
    },
    [syncCanvasToVideoDisplay],
  );

  const ensureDetectorVideoDimensions = useCallback(
    (modelName: "MoveNet" | "BlazePose") => {
      const video = videoRef.current;
      if (!video) return;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (video.width !== video.videoWidth) video.width = video.videoWidth;
        if (video.height !== video.videoHeight)
          video.height = video.videoHeight;
      }

      addLog(
        `[${modelName}] Video dims -> intrinsic ${video.videoWidth}x${video.videoHeight}, detectorInput ${video.width}x${video.height}, client ${video.clientWidth}x${video.clientHeight}`,
      );
    },
    [],
  );

  const summarizeFrames = useCallback(
    (label: string, frames: CapturedFrame[]) => {
      const first = frames[0];
      const last = frames[frames.length - 1];
      const samplePose = first?.poses?.[0];
      const sampleKeypoints = samplePose?.keypoints?.length ?? 0;

      addLog(
        `[${label}] frames=${frames.length}, firstTs=${first?.timestamp?.toFixed?.(3) ?? "n/a"}, lastTs=${last?.timestamp?.toFixed?.(3) ?? "n/a"}, samplePoseKeypoints=${sampleKeypoints}`,
      );

      console.log(`[Create][${label}] summary`, {
        frames: frames.length,
        firstTimestamp: first?.timestamp ?? null,
        lastTimestamp: last?.timestamp ?? null,
        samplePoseKeypoints: sampleKeypoints,
        samplePose,
      });
    },
    [],
  );

  // Preview skeleton detection (runs when video is paused/loaded)
  const detectAndDrawPreview = useCallback(async () => {
    if (
      !videoRef.current ||
      !detector ||
      !canvasRef.current ||
      isProcessingRef.current
    )
      return;

    try {
      const poses = await detector.estimatePoses(videoRef.current);

      drawCurrentPoses(poses, "movenet");
    } catch (err) {
      console.error("Preview detection error:", err);
    }
  }, [detector, drawCurrentPoses]);

  // Preview loop during normal video playback (not processing)
  const startPreviewPlayback = () => {
    if (isProcessingRef.current) return;

    const previewLoop = async () => {
      if (!videoRef.current || !detector || !canvasRef.current) return;
      if (videoRef.current.paused || videoRef.current.ended) return;
      if (isProcessingRef.current) return;

      try {
        const poses = await detector.estimatePoses(videoRef.current);

        drawCurrentPoses(poses, "movenet");
      } catch (err) {
        console.error("Preview playback error:", err);
      }

      // Continue loop if still playing and not processing
      if (
        !videoRef.current.paused &&
        !videoRef.current.ended &&
        !isProcessingRef.current
      ) {
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
      setTutorData([]);
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
      capturedData.length > 0 &&
      tutorData.length > 0
    );
  };

  // Canvas Resizing
  useEffect(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;

      const handleResize = () => {
        if (video.videoWidth && video.videoHeight) {
          syncCanvasToVideoDisplay();
        }
      };

      video.addEventListener("loadedmetadata", handleResize);
      window.addEventListener("resize", handleResize);
      return () => {
        video.removeEventListener("loadedmetadata", handleResize);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [videoUrl, syncCanvasToVideoDisplay]);

  // Start preview when detector becomes available and video is loaded
  useEffect(() => {
    if (detector && videoUrl && videoRef.current && !isProcessingRef.current) {
      // Give time for video to be ready
      const timeout = setTimeout(() => {
        detectAndDrawPreview();
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [detector, videoUrl, detectAndDrawPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreviewPlayback();
    };
  }, []);

  // Video processing loop
  const seekVideo = async (targetTime: number) => {
    const video = videoRef.current;
    if (!video) return;

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = targetTime;
    });
  };

  const processRangeWithDetector = async (
    activeDetector: PoseEstimator,
    modelName: "MoveNet" | "BlazePose",
  ): Promise<CapturedFrame[]> => {
    const video = videoRef.current;
    if (!video) return [];

    const [startTime, endTime] = timeRangeRef.current;
    const frames: CapturedFrame[] = [];

    const phaseStartedAt = performance.now();
    addLog(`[${modelName}] Starting range processing...`);
    ensureDetectorVideoDimensions(modelName);

    await seekVideo(startTime);

    ensureDetectorVideoDimensions(modelName);

    await video.play();

    return await new Promise<CapturedFrame[]>((resolve, reject) => {
      let stopped = false;
      let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

      const clearWatchdog = () => {
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
      };

      const cleanupVideoListeners = () => {
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("pause", handlePause);
      };

      const finish = (reason: string) => {
        if (stopped) return;
        stopped = true;
        clearWatchdog();
        cleanupVideoListeners();
        video.pause();
        const elapsedMs = performance.now() - phaseStartedAt;
        addLog(
          `[${modelName}] Finished (${reason}). Frames: ${frames.length}. Elapsed: ${elapsedMs.toFixed(0)}ms`,
        );
        if (frames.length === 0) {
          addLog(
            `[${modelName}] Warning: no poses detected in selected range.`,
          );
        }
        resolve(frames);
      };

      const fail = (error: unknown) => {
        if (stopped) return;
        stopped = true;
        clearWatchdog();
        cleanupVideoListeners();
        video.pause();
        reject(error);
      };

      const armWatchdog = () => {
        clearWatchdog();
        watchdogTimer = setTimeout(() => {
          if (stopped) return;

          if (video.currentTime >= endTime - 0.03 || video.ended) {
            finish("watchdog-end");
            return;
          }

          fail(
            new Error(`[${modelName}] Processing stalled before end of range`),
          );
        }, 2500);
      };

      const handleEnded = () => {
        finish("video-ended");
      };

      const handlePause = () => {
        if (stopped) return;
        if (video.currentTime >= endTime - 0.03) {
          finish("video-paused-at-end");
        }
      };

      video.addEventListener("ended", handleEnded);
      video.addEventListener("pause", handlePause);
      armWatchdog();

      const processDetectedPoses = async (timestamp: number) => {
        ensureDetectorVideoDimensions(modelName);
        const poses = await activeDetector.estimatePoses(video);

        if (poses.length > 0) {
          const frame = { timestamp, poses };
          frames.push(frame);

          if (modelName === "MoveNet") {
            setCapturedData([...frames]);
          } else {
            setTutorData([...frames]);
          }
        }

        if (canvasRef.current) {
          drawCurrentPoses(
            poses,
            modelName === "MoveNet" ? "movenet" : "blazepose",
          );
        }
      };

      const scheduleNextRaf = () => {
        requestRef.current = requestAnimationFrame(() => {
          void fallbackStep();
        });
      };

      const frameStep = async (
        _now: number,
        metadata: VideoFrameCallbackMetadata,
      ) => {
        if (stopped || video.paused || video.ended) {
          finish("frame-step-stop");
          return;
        }

        if (metadata.mediaTime > endTime) {
          finish("range-end");
          return;
        }

        if (metadata.mediaTime >= startTime) {
          try {
            await processDetectedPoses(metadata.mediaTime);
            armWatchdog();
          } catch (err) {
            fail(err);
            return;
          }
        }

        if (!video.paused && !video.ended && !stopped) {
          requestRef.current = video.requestVideoFrameCallback(frameStep);
        } else {
          finish("frame-step-loop-end");
        }
      };

      const fallbackStep = async () => {
        if (stopped || video.paused || video.ended) {
          finish("fallback-stop");
          return;
        }

        if (video.currentTime > endTime) {
          finish("fallback-range-end");
          return;
        }

        if (video.currentTime >= startTime) {
          try {
            await processDetectedPoses(video.currentTime);
            armWatchdog();
          } catch (err) {
            fail(err);
            return;
          }
        }

        if (!video.paused && !video.ended && !stopped) {
          scheduleNextRaf();
        } else {
          finish("fallback-loop-end");
        }
      };

      if ("requestVideoFrameCallback" in video) {
        requestRef.current = video.requestVideoFrameCallback(frameStep);
      } else {
        addLog(`Fallback loop (${modelName}, no rVFC)`);
        scheduleNextRaf();
      }
    });
  };

  const startProcessing = async () => {
    if (!videoRef.current || !detector || !blazePoseDetector) {
      addLog("Video o modelos no listos");
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
    setProcessingModel("MoveNet");
    setCapturedData([]);
    setTutorData([]);

    try {
      addLog("Processing selected range with MoveNet...");
      const movenetFrames = await processRangeWithDetector(detector, "MoveNet");
      setCapturedData(movenetFrames);
      addLog(
        `MoveNet finished. Captured ${movenetFrames.length} valid frames.`,
      );
      summarizeFrames("recording_points", movenetFrames);

      setProcessingModel("BlazePose");
      addLog("Switching model to BlazePose...");
      addLog("Skeleton overlay switched to BlazePose colors");
      addLog("Resetting video to selected start for BlazePose...");
      const blazePoseFrames = await processRangeWithDetector(
        blazePoseDetector,
        "BlazePose",
      );
      setTutorData(blazePoseFrames);
      addLog(
        `BlazePose finished. Captured ${blazePoseFrames.length} valid frames.`,
      );
      summarizeFrames("tutor_points", blazePoseFrames);

      const processedDuration = timeRange[1] - timeRange[0];
      addLog(
        `Processed range: ${timeRange[0].toFixed(2)}s - ${timeRange[1].toFixed(2)}s (${processedDuration.toFixed(2)}s)`,
      );
      addLog(
        `Processing summary -> recording_points: ${movenetFrames.length}, tutor_points: ${blazePoseFrames.length}`,
      );
    } catch (e) {
      addLog(`Error starting playback: ${e}`);
      console.error(e);
    } finally {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      isProcessingRef.current = false;
      setIsProcessing(false);
      setProcessingModel(null);
    }
  };

  // Stop when video ends
  const onVideoEnded = () => {
    // Stop preview playback
    stopPreviewPlayback();

    // Keep processing flags intact while the 2-phase pipeline is running.
    if (isProcessingRef.current) {
      addLog(
        "Video reached end while processing; pipeline keeps control for next phase.",
      );
      return;
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

      const filteredTutorData = tutorData.filter(
        (frame) =>
          frame.timestamp >= timeRange[0] && frame.timestamp <= timeRange[1],
      );

      const gridValidation = buildGridValidationDefinition(
        filteredTutorData.length > 0 ? filteredTutorData : filteredData,
      );

      addLog(
        `Generated event graph: ${eventGraph.nodes.length} nodes, ${eventGraph.edges.length} edges`,
      );
      addLog(
        `Detected ${Object.keys(signals).length} active signals: ${Object.keys(signals).join(", ") || "none"}`,
      );
      addLog(
        `Time constraints: ${timeConstraints.length}, Terminal nodes: ${completion.terminal_nodes.length}`,
      );
      addLog(
        `Grid validation: ${gridValidation.rows}x${gridValidation.cols}, keypoints=${gridValidation.keypoints.length}`,
      );

      // Debug: Log the generated data
      console.log("Generated signals:", signals);
      console.log("Generated eventGraph:", eventGraph);
      console.log("Generated timeConstraints:", timeConstraints);
      console.log("Generated completion:", completion);
      console.log("Generated gridValidation:", gridValidation);

      const recordData = {
        exercise_id: metadata.exercise_id,
        name: metadata.name,
        description: metadata.description,
        muscle_groups: metadata.muscle_groups.split(",").map((s) => s.trim()),
        difficulty: metadata.difficulty,
        instructions: metadata.instructions.filter((i) => i.trim() !== ""),
        signals,
        event_graph: eventGraph,
        grid_validation: gridValidation,
        time_constraints: timeConstraints,
        completion,
        recording_points: filteredData,
        tutor_points: filteredTutorData,
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
        {import.meta.env.DEV && (
          <button className="goto-player-btn" onClick={() => navigate("/player")}>
            {t("button.go_to_player") || "Go to Player"} →
          </button>
        )}
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
                {t("create.overlay_processing", {
                  count:
                    processingModel === "BlazePose"
                      ? tutorData.length
                      : capturedData.length,
                })}{" "}
                {processingModel ? `(${processingModel})` : ""}
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
              disabled={
                !videoUrl ||
                isProcessing ||
                !detector ||
                !blazePoseDetector ||
                isBlazePoseLoading
              }
            >
              {isProcessing
                ? `${t("button.processing")} (${processingModel ?? "MoveNet"})`
                : t("button.process")}
            </button>

            <button
              className="save-btn"
              onClick={handleSave}
              disabled={
                capturedData.length === 0 ||
                tutorData.length === 0 ||
                isProcessing ||
                isSaving
              }
              title={
                capturedData.length === 0
                  ? "Process a video first to capture data"
                  : tutorData.length === 0
                    ? "BlazePose processing is required before saving"
                    : !isFormValid()
                      ? t("create.log.fill_form")
                      : t("button.save")
              }
            >
              {isSaving ? t("button.saving") : t("button.save")} (
              {capturedData.length}/{tutorData.length})
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
