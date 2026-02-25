import type { Exercise } from "../types/exercise";
import SelectableCard from "./SelectableCard";
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
  return (
    <SelectableCard selected={isSelected} onClick={onClick} className="exercise-card">
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

      {isSelected && typeof reps === "number" && onRepsChange ? (
        <div className="exercise-card__reps-control" onClick={(e) => e.stopPropagation()}>
          <span className="exercise-card__reps-label">Reps</span>
          <div className="exercise-card__reps-stepper">
            <button
              type="button"
              className="exercise-card__reps-btn"
              disabled={reps <= 1}
              onClick={() => onRepsChange(Math.max(1, reps - 1))}
            >
              −
            </button>
            <input
              className="exercise-card__reps-input"
              type="number"
              min={1}
              value={reps}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value || "1", 10);
                onRepsChange(Number.isFinite(next) ? Math.max(1, next) : 1);
              }}
            />
            <button
              type="button"
              className="exercise-card__reps-btn"
              onClick={() => onRepsChange(reps + 1)}
            >
              +
            </button>
          </div>
        </div>
      ) : null}
    </SelectableCard>
  );
}
