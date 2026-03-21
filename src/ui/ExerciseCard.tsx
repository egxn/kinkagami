import { useTranslation } from "react-i18next";
import type { Exercise } from "../types/exercise";
import "./ExerciseCard.scss";

export interface ExerciseCardProps {
  exercise: Exercise;
  isSelected: boolean;
}

export default function ExerciseCard({
  exercise,
  isSelected,
}: ExerciseCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`exercise-card ${isSelected ? "exercise-card--selected" : ""}`}
    >
      {isSelected ? (
        <div className="exercise-card__badge" aria-hidden="true">
          ✅
        </div>
      ) : null}
      <div className="exercise-card__left">
        <h3 className="exercise-card__title">
          {exercise.name || t("common.unnamed")}
        </h3>
        <p className="exercise-card__description">
          {exercise.description || t("common.no_description")}
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
            <span className="exercise-card__duration">
              {exercise.duration}s
            </span>
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
  );
}
