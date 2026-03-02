import type { Exercise } from "../types/exercise";
import Button from "./Button";
import usePoseContext from "../context/usePoseContext";
import { logger } from "../utils/logger";
import "./ExerciseCard.scss";

interface ExerciseCardProps {
  exercise: Exercise;
  isSelected: boolean;
  onClick: () => void;
}

export default function ExerciseCard({
  exercise,
  isSelected,
  onClick,
}: ExerciseCardProps) {
  const { videoRef, streamReady } = usePoseContext();

  return (
    <Button
      videoRef={videoRef}
      streamReady={streamReady}
      onAction={() => {
        if (!isSelected) onClick();
      }}
      onDiscard={() => {
        logger.log("ExerciseCard", "Exercise action discarded");
      }}
      alignX="left"
      style={{
        width: "100%",
        justifyContent: "flex-start",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }}
    >
      <div className={`exercise-card ${isSelected ? "exercise-card--selected" : ""}`}>
        {isSelected ? (
          <div className="exercise-card__badge" aria-hidden="true">
            ✅
          </div>
        ) : null}
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
      </div>
    </Button>
  );
}
