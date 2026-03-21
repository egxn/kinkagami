import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { useTranslation } from "react-i18next";

import Skeleton from "../../components/Skeleton";
import usePoseContext from "../../context/usePoseContext";
import {
  useAppConfig,
  useHandPose,
  useModelVersions,
  usePoseDetection,
} from "../../hooks";
import { logger } from "../../utils/logger";
import type { HandPrediction, PoseEstimator } from "../../types/inference";
import type {
  BlazePoseVersion,
  HandPoseVersion,
  MoveNetVersion,
} from "../../utils/modelVersions";

type ModelOption = "movenet" | "blazepose" | "handpose";

function PoseModelCanvas({
  detector,
  modelLoading,
  modelError,
  streamReady,
  videoRef,
  debugTag,
  debugVerbose = false,
}: {
  detector: PoseEstimator | null;
  modelLoading: boolean;
  modelError: string | null;
  streamReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  debugTag: string;
  debugVerbose?: boolean;
}) {
  const { t } = useTranslation();
  const [poses, setPoses] = useState<poseDetection.Pose[]>([]);

  const handlePosesDetected = useCallback((nextPoses: poseDetection.Pose[]) => {
    setPoses(nextPoses);
  }, []);

  usePoseDetection({
    detector,
    videoRef,
    modelLoading,
    streamReady,
    onPosesDetected: handlePosesDetected,
    debugTag,
    debugVerbose,
  });

  return (
    <>
      <Skeleton
        variant="video"
        autoSize
        videoRef={videoRef}
        poses={poses}
        opacity={1}
        poseModel="auto"
      />
      <p style={{ marginTop: 8 }}>
        {modelLoading && t("models.loading_model")}
        {!modelLoading && modelError && `${t("common.error_prefix")}: ${modelError}`}
        {!modelLoading && !modelError && t("models.model_ready_poses")}
      </p>
    </>
  );
}

function HandModelCanvas({
  streamReady,
  videoRef,
}: {
  streamReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  const { t } = useTranslation();
  const {
    detector,
    isLoading: modelLoading,
    error: modelError,
  } = useHandPose();
  const [hands, setHands] = useState<HandPrediction[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    const detect = async () => {
      if (!mounted) return;

      const video = videoRef.current;
      if (
        !detector ||
        modelLoading ||
        !streamReady ||
        !video ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        timeoutId = setTimeout(detect, 60);
        return;
      }

      try {
        // Sync HTML attributes so the library's getImageSize reads real dimensions
        if (video.width !== video.videoWidth) video.width = video.videoWidth;
        if (video.height !== video.videoHeight)
          video.height = video.videoHeight;

        const result = (await detector.estimateHands(
          video,
        )) as HandPrediction[];
        if (mounted) {
          setHands(result ?? []);
        }
      } catch (error) {
        logger.error("Models", "HandPose detection error", error);
      } finally {
        timeoutId = setTimeout(detect, 30);
      }
    };

    detect();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [detector, modelLoading, streamReady, videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!canvas || !container || !video) return;

    const rect = container.getBoundingClientRect();
    const displayW = Math.max(1, Math.floor(rect.width));
    const displayH = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    if (!video.videoWidth || !video.videoHeight) return;

    const sx = displayW / video.videoWidth;
    const sy = displayH / video.videoHeight;

    for (const hand of hands) {
      for (const kp of hand.keypoints ?? []) {
        const x = kp.x * sx;
        const y = kp.y * sy;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#00d4ff";
        ctx.fill();

        if (kp.name) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "10px monospace";
          ctx.fillText(kp.name, x + 6, y - 6);
        }
      }
    }
  }, [hands, videoRef]);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      </div>
      <p style={{ marginTop: 8 }}>
        {modelLoading && t("models.loading_model")}
        {!modelLoading && modelError && `${t("common.error_prefix")}: ${modelError}`}
        {!modelLoading && !modelError && t("models.model_ready_hands")}
      </p>
    </>
  );
}

export default function Models() {
  const { t } = useTranslation();
  const {
    cameraError,
    cameraReady,
    detector: poseDetector,
    modelError: poseModelError,
    modelLoading: poseModelLoading,
    stream,
    streamReady,
    videoRef,
  } = usePoseContext();
  const { config: modelVersions, updateConfig: updateModelVersions } =
    useModelVersions();
  const { config: appConfig, patchConfig } = useAppConfig();

  const [selectedModel, setSelectedModel] = useState<ModelOption>(() => {
    return appConfig.models.poseModel;
  });

  const activeModel: ModelOption =
    selectedModel === "handpose" ? "handpose" : appConfig.models.poseModel;

  useEffect(() => {
    const video = videoRef.current;
    logger.log("Models", "Model selection changed", {
      selectedModel,
      activeModel,
      streamReady,
      hasStream: !!stream,
      hasVideo: !!video,
      videoReadyState: video?.readyState,
      videoWidth: video?.videoWidth,
      videoHeight: video?.videoHeight,
    });
  }, [activeModel, selectedModel, streamReady, stream, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const playVideo = async () => {
      try {
        if (video.paused) {
          await video.play();
        }
      } catch (error) {
        logger.error("Models", "Error playing video", error);
      }
    };

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.addEventListener("loadedmetadata", playVideo, { once: true });
    }

    return () => {
      video.removeEventListener("loadedmetadata", playVideo);
    };
  }, [stream, videoRef]);

  const selectedLabel = useMemo(() => {
    if (activeModel === "movenet") return "MoveNet";
    if (activeModel === "blazepose") return "BlazePose";
    return "HandPose";
  }, [activeModel]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        padding: 16,
        color: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label htmlFor="model-selector">{t("models.model")}</label>
        <select
          id="model-selector"
          value={activeModel}
          onChange={(e) => {
            const next = e.target.value as ModelOption;
            setSelectedModel(next);

            if (next === "movenet" || next === "blazepose") {
                patchConfig({
                  models: {
                    poseModel: next,
                  } as typeof appConfig.models,
                });
              }
          }}
          style={{ padding: "8px 10px" }}
        >
          <option value="movenet">MoveNet</option>
          <option value="blazepose">BlazePose</option>
          <option value="handpose">HandPose</option>
        </select>

        {activeModel === "movenet" && (
          <>
            <label htmlFor="movenet-version">{t("models.movenet_version")}</label>
            <select
              id="movenet-version"
              value={modelVersions.movenet}
              onChange={(e) => {
                const movenet = e.target.value as MoveNetVersion;
                updateModelVersions({ movenet });
                patchConfig({
                  models: {
                    movenet,
                  } as typeof appConfig.models,
                });
              }}
              style={{ padding: "8px 10px" }}
            >
              <option value="lightning">lightning ({t("models.lightweight")})</option>
              <option value="thunder">thunder</option>
            </select>
          </>
        )}

        {activeModel === "blazepose" && (
          <>
            <label htmlFor="blazepose-version">{t("models.blazepose_version")}</label>
            <select
              id="blazepose-version"
              value={modelVersions.blazepose}
              onChange={(e) => {
                const blazepose = e.target.value as BlazePoseVersion;
                updateModelVersions({
                  blazepose,
                });
                patchConfig({
                  models: {
                    blazepose,
                  } as typeof appConfig.models,
                });
              }}
              style={{ padding: "8px 10px" }}
            >
              <option value="lite">lite ({t("models.lightweight")})</option>
              <option value="full">full</option>
              <option value="heavy">heavy</option>
            </select>
          </>
        )}

        {activeModel === "handpose" && (
          <>
            <label htmlFor="handpose-version">{t("models.handpose_version")}</label>
            <select
              id="handpose-version"
              value={modelVersions.handpose}
              onChange={(e) => {
                const handpose = e.target.value as HandPoseVersion;
                updateModelVersions({ handpose });
                patchConfig({
                  models: {
                    handpose,
                  } as typeof appConfig.models,
                });
              }}
              style={{ padding: "8px 10px" }}
            >
              <option value="lite">lite ({t("models.lightweight")})</option>
              <option value="full">full</option>
            </select>
          </>
        )}

        <span>
          {t("common.camera")}: {cameraReady ? t("common.ready") : t("common.initializing")}
          {cameraError ? ` (${cameraError})` : ""}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 56,
          left: 16,
          right: 16,
          bottom: 16,
          border: "1px solid rgba(255,255,255,0.3)",
          transform: "scaleX(-1)",
        }}
      >
        {activeModel === "movenet" && (
          <PoseModelCanvas
            detector={poseDetector}
            modelLoading={poseModelLoading}
            modelError={poseModelError}
            streamReady={streamReady}
            videoRef={videoRef}
            debugTag="MoveNet/Models"
          />
        )}

        {activeModel === "blazepose" && (
          <PoseModelCanvas
            detector={poseDetector}
            modelLoading={poseModelLoading}
            modelError={poseModelError}
            streamReady={streamReady}
            videoRef={videoRef}
            debugTag="BlazePose/Models"
            debugVerbose
          />
        )}

        {activeModel === "handpose" && (
          <HandModelCanvas streamReady={streamReady} videoRef={videoRef} />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          top: 20,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 6,
          padding: "8px 10px",
        }}
      >
        {t("models.validating_model")}: {selectedLabel}
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
          MoveNet: {modelVersions.movenet} · BlazePose:{" "}
          {modelVersions.blazepose} · HandPose: {modelVersions.handpose}
        </div>
      </div>
    </div>
  );
}
