import type { Exercise } from "../types/exercise";
import Button from "./Button";
import usePoseContext from "../context/usePoseContext";
import { logger } from "../utils/logger";
import "./ExerciseCard.scss";

interface ExerciseCardProps {
  exercise: Exercise;
  isSelected: boolean;
  onClick: () => void;
  reps?: number;
  onRepsChange?: (reps: number) => void;
}

export default function ExerciseCard({
  exercise,
  isSelected,
  onClick,
  reps,
  onRepsChange,
}: ExerciseCardProps) {
  const { videoRef, streamReady } = usePoseContext();
  const safeReps = Math.max(1, reps ?? exercise.reps ?? 1);

  return (
    <Button
      videoRef={videoRef}
      streamReady={streamReady}
      onAction={() => {
        if (!isSelected) onClick();
      }}
      onDiscard={() => {
        logger.log("ExerciseCard", "Exercise action discarded");
        if (isSelected) onClick();
      }}
      onIncrease={() => {
        if (!isSelected || !onRepsChange) return;
        onRepsChange(safeReps + 1);
      }}
      onDecrease={() => {
        if (!isSelected || !onRepsChange) return;
        onRepsChange(Math.max(1, safeReps - 1));
      }}
      alignX="left"
      mode="checkbox"
      checked={isSelected}
      style={{ width: "80%", justifyContent: "flex-start" }}
    >
      <div className={`exercise-card ${isSelected ? "exercise-card--selected" : ""}`}>
        <div className="exercise-card__left">
          <h3 className="exercise-card__title">{exercise.name || "Sin nombre"}</h3>
          <p className="exercise-card__description">
            {exercise.description || "Sin descripción"}
          </p>
          <div className="exercise-card__meta">
            {exercise.difficulty && (
              <span
                className={`exercise-card__difficulty exercise-card__difficulty--${exercise.difficulty}`}
              >
                {exercise.difficulty}
              </span>
            )}
            {exercise.duration && (
              <span className="exercise-card__duration">{exercise.duration}s</span>
            )}
            {exercise.reps && exercise.sets && (
              <span className="exercise-card__reps">
                {exercise.sets}x{exercise.reps}
              </span>
            )}
          </div>
          {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
            <div className="exercise-card__muscles">
              {exercise.muscle_groups.slice(0, 3).map((muscle, idx) => (
                <span key={idx} className="exercise-card__muscle-tag">
                  {muscle}
                </span>
              ))}
              {exercise.muscle_groups.length > 3 && (
                <span className="exercise-card__muscle-tag">
                  +{exercise.muscle_groups.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="exercise-card__right">
          <div className="exercise-card__reps-label">Reps</div>
          <div className="exercise-card__reps-value">{safeReps}</div>
          {isSelected ? (
            <div className="exercise-card__reps-hint">↑ subir · ↓ bajar</div>
          ) : (
            <div className="exercise-card__reps-hint">Selecciona para editar</div>
          )}
        </div>
      </div>
    </Button>
  );
}
