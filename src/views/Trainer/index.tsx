import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "../../components/Skeleton";
import { getAllExercises, getExerciseById } from "../../db/dbService";
import { useRoutine } from "../../context/useRoutine";
import type { Exercise, RoutineExerciseItem } from "../../types/exercise";

import "./Trainer.scss";

export default function Trainer() {
  const { selectedRoutine } = useRoutine();

  const [started, setStarted] = useState(false);
  const [loadingExercise, setLoadingExercise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

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

  const canStart = routineItems.length > 0;
  const activeItem = routineItems[currentExerciseIndex];

  useEffect(() => {
    // Reset session when routine changes
    setStarted(false);
    setCurrentExercise(null);
    setCurrentExerciseIndex(0);
    setFrameIndex(0);
    setError(null);
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

  const start = useCallback(async () => {
    if (!selectedRoutine) {
      setError("No hay una rutina seleccionada");
      return;
    }
    if (!activeItem?.exerciseId) {
      setError("La rutina no tiene ejercicios");
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
        throw new Error(`No se encontró el ejercicio: ${activeItem.exerciseId}`);
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
  }, [activeItem?.exerciseId, selectedRoutine]);

  // Loop playback for now
  useEffect(() => {
    stopPlayback();

    if (!started || !currentExercise) return;
    const frames = currentExercise.recording_points ?? [];
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
            exercise={currentExercise}
            frameIndex={frameIndex}
            opacity={0.7}
            colors={{ skeleton: "#00BFFF", keypoints: "#FFD700" }}
          />
        )}
      </div>

      <div className="trainer-view__ui">
        <div className="trainer-view__actions">
          <button
            type="button"
            onClick={start}
            disabled={!canStart || loadingExercise}
          >
            {loadingExercise ? "Cargando..." : started ? "Reiniciar" : "Empezar"}
          </button>

          {error && <div className="trainer-view__error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
