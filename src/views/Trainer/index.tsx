import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import { useTranslation } from "react-i18next";
import Skeleton from "../../components/Skeleton";
import { getAllExercises, getExerciseById } from "../../db/dbService";
import { useRoutine } from "../../context/useRoutine";
import usePoseContext from "../../context/usePoseContext";
import { useAppConfig, usePoseDetection } from "../../hooks";
import { useSessionComparison } from "../../context/useSessionComparison";
import type { Exercise, RoutineExerciseItem } from "../../types/exercise";
import { logger } from "../../utils/logger";

import "./Trainer.scss";

const SCORE_THRESHOLD = 80;
const SCORE_RELEASE_THRESHOLD = 70;

export default function Trainer() {
  const { t } = useTranslation();
  const LOG_TAG = "FSM_COMPARE";
  const { selectedRoutine } = useRoutine();
  const { config } = useAppConfig();
  const { detector, videoRef, modelLoading, streamReady } = usePoseContext();
  const { setExercise, processPose, reset, snapshot } = useSessionComparison();

  const [started, setStarted] = useState(false);
  const [loadingExercise, setLoadingExercise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentRepCount, setCurrentRepCount] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [routineCompleted, setRoutineCompleted] = useState(false);
  const [exerciseNameById, setExerciseNameById] = useState<
    Record<string, string>
  >({});

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastSignalsLogAtRef = useRef(0);
  const repCompletionLockedRef = useRef(false);

  const routineItems = useMemo<RoutineExerciseItem[]>(() => {
    if (!selectedRoutine) return [];
    if (selectedRoutine.items && selectedRoutine.items.length > 0) {
      return selectedRoutine.items;
    }
    return (selectedRoutine.exercises ?? []).map((exerciseId) => ({
      exerciseId,
      reps: 1,
    }));
  }, [selectedRoutine]);

  const activeItem = routineItems[currentExerciseIndex];
  const targetReps = Math.max(1, activeItem?.reps ?? 1);
  const evaluationType = config.evaluation.type;

  const scorePercent = useMemo(() => {
    if (evaluationType === "grid") {
      if (Number.isFinite(snapshot.gridScore)) return snapshot.gridScore;
      return Math.round((snapshot.gridProgress ?? 0) * 100);
    }

    return snapshot.progressScore;
  }, [
    evaluationType,
    snapshot.gridProgress,
    snapshot.gridScore,
    snapshot.progressScore,
  ]);

  useEffect(() => {
    // Reset session when routine changes
    setStarted(false);
    setCurrentExercise(null);
    setCurrentExerciseIndex(0);
    setCurrentRepCount(0);
    setFrameIndex(0);
    setCountdown(routineItems.length > 0 ? 5 : null);
    setRoutineCompleted(false);
    setError(null);
    repCompletionLockedRef.current = false;
    reset();
  }, [selectedRoutine?._id, routineItems.length, reset]);

  const handleLivePosesDetected = useCallback(
    (poses: Pose[]) => {
      if (!started || !currentExercise) return;
      const firstPose = poses[0];
      if (!firstPose) return;
      processPose(firstPose);
    },
    [started, currentExercise, processPose],
  );

  usePoseDetection({
    detector,
    videoRef,
    modelLoading,
    streamReady,
    onPosesDetected: handleLivePosesDetected,
    debugTag: "Trainer/SessionComparator",
  });

  useEffect(() => {
    let mounted = true;

    const loadExerciseNames = async () => {
      try {
        const all = await getAllExercises();
        if (!mounted) return;

        const map: Record<string, string> = {};
        for (const ex of all) {
          if (ex._id) map[ex._id] = ex.name ?? ex.exercise_id ?? ex._id;
          if (ex.exercise_id) map[ex.exercise_id] = ex.name ?? ex.exercise_id;
        }

        setExerciseNameById(map);
      } catch {
        if (mounted) setExerciseNameById({});
      }
    };

    void loadExerciseNames();

    return () => {
      mounted = false;
    };
  }, [selectedRoutine?._id]);

  const stopPlayback = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const completeCurrentRep = useCallback(() => {
    if (!activeItem) return;

    const nextRepCount = currentRepCount + 1;
    if (nextRepCount < targetReps) {
      setCurrentRepCount(nextRepCount);
      setFrameIndex(0);
      startTimeRef.current = performance.now();
      reset();
      return;
    }

    const hasNextExercise = currentExerciseIndex < routineItems.length - 1;
    if (hasNextExercise) {
      setCurrentExerciseIndex((prev) => prev + 1);
      setCurrentRepCount(0);
      setStarted(false);
      setCurrentExercise(null);
      setFrameIndex(0);
      setCountdown(0);
      reset();
      return;
    }

    setRoutineCompleted(true);
    setStarted(false);
    setCurrentExercise(null);
    setFrameIndex(0);
    setCountdown(null);
    reset();
  }, [
    activeItem,
    currentExerciseIndex,
    currentRepCount,
    reset,
    routineItems.length,
    targetReps,
  ]);

  useEffect(() => {
    if (!started || !currentExercise || routineCompleted) return;

    if (scorePercent >= SCORE_THRESHOLD && !repCompletionLockedRef.current) {
      repCompletionLockedRef.current = true;
      completeCurrentRep();
    }
  }, [completeCurrentRep, currentExercise, routineCompleted, scorePercent, started]);

  useEffect(() => {
    if (scorePercent <= SCORE_RELEASE_THRESHOLD) {
      repCompletionLockedRef.current = false;
    }
  }, [scorePercent]);

  const start = useCallback(async () => {
    if (!selectedRoutine) {
      setError(t("trainer.no_routine"));
      return;
    }
    if (!activeItem?.exerciseId) {
      setError(t("trainer.routine_without_exercises"));
      return;
    }

    try {
      setError(null);
      setLoadingExercise(true);
      let ex: Exercise | null = null;

      try {
        ex = await getExerciseById(activeItem.exerciseId);
      } catch {
        // Backwards compatibility: routine may store `exercise_id` instead of PouchDB `_id`
        const all = await getAllExercises();
        ex =
          all.find((e) => e._id === activeItem.exerciseId) ??
          all.find((e) => e.exercise_id === activeItem.exerciseId) ??
          null;
      }

      if (!ex) {
        throw new Error(t("trainer.exercise_not_found", { id: activeItem.exerciseId }));
      }

      setCurrentExercise(ex);
      setFrameIndex(0);
      startTimeRef.current = performance.now();
      setStarted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarted(false);
      setCurrentExercise(null);
    } finally {
      setLoadingExercise(false);
    }
  }, [activeItem?.exerciseId, selectedRoutine, t]);

  useEffect(() => {
    if (countdown == null) return;
    if (loadingExercise || started) return;

    if (countdown === 0) {
      const kickoffTimer = setTimeout(() => {
        void start();
        setCountdown(null);
      }, 350);
      return () => clearTimeout(kickoffTimer);
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev == null ? null : Math.max(0, prev - 1)));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, loadingExercise, started, start]);

  useEffect(() => {
    if (!started || !currentExercise) {
      reset();
      return;
    }

    setExercise(currentExercise);

    const signalKeys = Object.keys(currentExercise.signals ?? {});
    logger.info(LOG_TAG, "Exercise loaded for comparison", {
      exerciseId: currentExercise._id ?? currentExercise.exercise_id,
      exerciseName: currentExercise.name,
      signalsCount: signalKeys.length,
      signals: signalKeys,
      eventNodes: currentExercise.event_graph?.nodes.length ?? 0,
      eventEdges: currentExercise.event_graph?.edges.length ?? 0,
    });
  }, [started, currentExercise, setExercise, reset]);

  useEffect(() => {
    if (!started) return;
    const activeSignals = snapshot.activeSignals ?? {};
    const keys = Object.keys(activeSignals);
    const hasGridMetrics = snapshot.gridTotalKeypoints > 0;
    if (keys.length === 0 && !hasGridMetrics) return;

    const now = Date.now();
    if (now - lastSignalsLogAtRef.current < 1000) return;
    lastSignalsLogAtRef.current = now;

    logger.log(LOG_TAG, "Incoming active signals", activeSignals);
    if (hasGridMetrics) {
      logger.log(LOG_TAG, "Grid comparator metrics", {
        gridScore: snapshot.gridScore,
        gridProgress: snapshot.gridProgress,
        gridMatchedKeypoints: snapshot.gridMatchedKeypoints,
        gridTotalKeypoints: snapshot.gridTotalKeypoints,
      });
    }
  }, [
    snapshot.activeSignals,
    snapshot.gridMatchedKeypoints,
    snapshot.gridProgress,
    snapshot.gridScore,
    snapshot.gridTotalKeypoints,
    started,
  ]);

  // Loop playback for now
  useEffect(() => {
    stopPlayback();

    if (!started || !currentExercise) return;
    const frames =
      currentExercise.tutor_points && currentExercise.tutor_points.length > 0
        ? currentExercise.tutor_points
        : (currentExercise.recording_points ?? []);
    if (frames.length === 0) return;

    const baseTimestamp = frames[0].timestamp;
    const lastTimestamp = frames[frames.length - 1].timestamp;

    const playbackSpeed = 1;

    const animate = (currentTime: number) => {
      const elapsedMs = (currentTime - startTimeRef.current) * playbackSpeed;
      const elapsedSeconds = elapsedMs / 1000;
      const targetTimestamp = baseTimestamp + elapsedSeconds;

      // Loop when reaching end
      if (targetTimestamp >= lastTimestamp) {
        startTimeRef.current = currentTime;
        setFrameIndex(0);
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Find frame closest to target timestamp
      let nextIndex = 0;
      for (let i = 0; i < frames.length; i++) {
        if (frames[i].timestamp <= targetTimestamp) {
          nextIndex = i;
        } else {
          break;
        }
      }

      setFrameIndex(nextIndex);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      stopPlayback();
    };
  }, [currentExercise, started, stopPlayback]);

  return (
    <div className="trainer-view">
      <div className="trainer-view__ghost">
        {started && currentExercise && (
          <Skeleton
            autoSize
            poses={
              (currentExercise.tutor_points &&
              currentExercise.tutor_points.length > 0
                ? currentExercise.tutor_points
                : currentExercise.recording_points)?.[frameIndex]?.poses ?? []
            }
            opacity={0.7}
            poseModel="blazepose"
          />
        )}
      </div>

      <div className="trainer-view__ui">
        <div className="trainer-view__actions trainer-view__actions--top-right">
          <div className="trainer-view__routine-overlay">
            <div className="trainer-view__routine-title">{t("trainer.routine_label")}</div>
            <ul className="trainer-view__routine-list">
              {routineItems.map((item, idx) => {
                const name =
                  exerciseNameById[item.exerciseId] ?? item.exerciseId;
                return (
                  <li
                    key={`${item.exerciseId}-${idx}`}
                    className={`trainer-view__routine-item ${
                      idx === currentExerciseIndex ? "is-active" : ""
                    }`}
                  >
                    <span className="trainer-view__routine-index">
                      {idx + 1}.
                    </span>
                    <span className="trainer-view__routine-name">{name}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {countdown !== null && !started && (
          <div className="trainer-view__countdown">{countdown}</div>
        )}

        <div className="trainer-view__status">
          {started && !routineCompleted && (
            <div className="trainer-view__score">
              {t("trainer.score_status", {
                mode: evaluationType,
                score: Math.round(scorePercent),
                threshold: SCORE_THRESHOLD,
              })}
            </div>
          )}
          {started && !routineCompleted && (
            <div className="trainer-view__rep-progress">
              {t("trainer.rep_progress", {
                current: currentRepCount,
                total: targetReps,
              })}
            </div>
          )}
          {routineCompleted && (
            <div className="trainer-view__complete">{t("trainer.routine_complete")}</div>
          )}
          {loadingExercise && (
            <div className="trainer-view__loading">{t("trainer.loading_exercise")}</div>
          )}
          {error && <div className="trainer-view__error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
