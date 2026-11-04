import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  SCORE_THRESHOLD,
  createSessionComparator,
  createTrainerSession,
  getTargetReps,
  resolveRoutineItems,
  selectScorePercent,
  stepTrainerSession,
  type Exercise,
  type Routine,
  type SessionComparatorSnapshot,
} from "@kgm/core";
import { drawPosesOnCanvas } from "@kgm/ui";
import { createMovenetDetector, type PoseDetector } from "../pose/movenet";
import {
  exerciseRepository,
  routineRepository,
} from "../platform/repositories";
import { useConfig } from "../platform/useConfig";
import { useCamera } from "./useCamera";

type Phase = "idle" | "countdown" | "running" | "done" | "error";

const COUNTDOWN_SECONDS = 3;
const UI_UPDATE_MS = 100;

async function loadExercise(exerciseId: string): Promise<Exercise> {
  try {
    return await exerciseRepository.getById(exerciseId);
  } catch {
    // Routines may reference `exercise_id` instead of the storage `_id`.
    const all = await exerciseRepository.getAll();
    const found = all.find(
      (e) => e._id === exerciseId || e.exercise_id === exerciseId,
    );
    if (!found) throw new Error(`Ejercicio no encontrado: ${exerciseId}`);
    return found;
  }
}

export default function Trainer() {
  const { routineId } = useParams();
  const { config } = useConfig();
  const evaluationType = config.evaluation.type;
  const movenetVersion = config.models.movenet;

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [detector, setDetector] = useState<PoseDetector | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [session, setSession] = useState(createTrainerSession);
  const [snapshot, setSnapshot] = useState<SessionComparatorSnapshot | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef(session);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { videoRef, ready: cameraReady, error: cameraError } = useCamera();

  const items = useMemo(() => resolveRoutineItems(routine), [routine]);
  const activeItem = items[session.exerciseIndex];

  // Routine
  useEffect(() => {
    if (!routineId) return;
    let cancelled = false;
    routineRepository
      .getById(routineId)
      .then((r) => !cancelled && setRoutine(r))
      .catch(() => !cancelled && setError("Rutina no encontrada."));
    return () => {
      cancelled = true;
    };
  }, [routineId]);

  // Detector
  useEffect(() => {
    let cancelled = false;
    let created: PoseDetector | null = null;
    createMovenetDetector(movenetVersion)
      .then((d) => {
        if (cancelled) d.dispose();
        else {
          created = d;
          setDetector(d);
        }
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [movenetVersion]);

  // Countdown, then load the active exercise
  useEffect(() => {
    if (phase !== "countdown") return;

    if (count > 0) {
      const timer = setTimeout(() => setCount((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (!activeItem) return;
    let cancelled = false;
    loadExercise(activeItem.exerciseId)
      .then((ex) => {
        if (cancelled) return;
        setExercise(ex);
        setPhase("running");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [phase, count, activeItem]);

  // Detection + scoring loop
  useEffect(() => {
    if (phase !== "running" || !exercise || !detector) return;

    const comparator = createSessionComparator(exercise);
    let cancelled = false;
    let frame = 0;
    let lastUi = 0;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        try {
          const poses = await detector.estimatePoses(video);
          if (cancelled) return;

          const { clientWidth, clientHeight } = canvas;
          if (canvas.width !== clientWidth) canvas.width = clientWidth;
          if (canvas.height !== clientHeight) canvas.height = clientHeight;
          const pose = poses[0] ?? null;
          drawPosesOnCanvas(canvas, video, pose ? [pose] : [], {
            poseModel: "movenet",
            fitMode: "contain",
          });

          if (pose) {
            const now = performance.now();
            const snap = comparator.update(pose, now);
            const step = stepTrainerSession(
              sessionRef.current,
              selectScorePercent(snap, evaluationType),
              items,
              { canComplete: true },
            );

            if (step.state !== sessionRef.current) {
              sessionRef.current = step.state;
              setSession(step.state);
            }

            if (step.event.type === "rep_completed") {
              comparator.reset();
            } else if (step.event.type === "exercise_completed") {
              setCount(COUNTDOWN_SECONDS - 1);
              setPhase("countdown");
              return;
            } else if (step.event.type === "routine_completed") {
              setPhase("done");
              return;
            }

            if (now - lastUi > UI_UPDATE_MS) {
              lastUi = now;
              setSnapshot(snap);
            }
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e));
            setPhase("error");
          }
          return;
        }
      }

      frame = requestAnimationFrame(() => void tick());
    };

    frame = requestAnimationFrame(() => void tick());
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [phase, exercise, detector, evaluationType, items, videoRef]);

  const start = () => {
    const fresh = createTrainerSession();
    sessionRef.current = fresh;
    setSession(fresh);
    setSnapshot(null);
    setError(null);
    setCount(COUNTDOWN_SECONDS);
    setPhase("countdown");
  };

  const score = snapshot
    ? Math.round(selectScorePercent(snapshot, evaluationType))
    : 0;
  const canStart = Boolean(
    routine && detector && cameraReady && items.length > 0,
  );
  const problem = error ?? cameraError;

  return (
    <main className="trainer">
      <header className="bar">
        <Link to="/">← Rutinas</Link>
        <h2>{routine?.name ?? "Entrenamiento"}</h2>
      </header>

      <div className="stage">
        <video ref={videoRef} className="mirror" playsInline muted />
        <canvas ref={canvasRef} className="mirror overlay" />
        {phase === "countdown" && (
          <div className="big">{count > 0 ? count : "¡Ya!"}</div>
        )}
        {phase === "done" && <div className="big">¡Rutina completada!</div>}
      </div>

      {problem && <p className="error">{problem}</p>}

      {(phase === "idle" || phase === "done" || phase === "error") && (
        <button disabled={!canStart} onClick={start}>
          {phase === "idle" ? "Comenzar" : "Repetir"}
        </button>
      )}
      {!canStart && phase === "idle" && !problem && (
        <p className="muted">Preparando cámara y modelo…</p>
      )}

      {phase === "running" && (
        <section className="hud">
          <div>
            <strong>
              {exercise?.name ?? exercise?.exercise_id ?? "Ejercicio"}
            </strong>{" "}
            · {session.exerciseIndex + 1}/{items.length} · rep{" "}
            {session.repCount}/{getTargetReps(activeItem)}
          </div>
          <div>
            Score: {score}%{" "}
            <span className="muted">(meta {SCORE_THRESHOLD}%)</span>
          </div>
          <progress max={100} value={score} />
          {snapshot && snapshot.accuracyScore > 0 && (
            <div className="muted">
              Precisión {snapshot.accuracyScore}%
              {snapshot.tempoTotal > 0
                ? ` · tempo ${snapshot.tempoScore}%`
                : ""}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
