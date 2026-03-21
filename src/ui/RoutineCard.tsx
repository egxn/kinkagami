import { useTranslation } from "react-i18next";
import type { Routine } from "../types/exercise";
import "./RoutineCard.scss";

export interface RoutineCardProps {
  routine: Routine;
  isSelected?: boolean;
}

export default function RoutineCard({
  routine,
  isSelected,
}: RoutineCardProps) {
  const { t } = useTranslation();
  const count = routine.items?.length ?? routine.exercises?.length ?? 0;

  return (
    <div
      className={`routine-card ${isSelected ? "routine-card--selected" : ""}`}
    >
      <h3 className="routine-card__title">
        {routine.name || t("common.unnamed")}
      </h3>
      <p className="routine-card__description">
        {routine.description || t("common.no_description")}
      </p>
      <div className="routine-card__meta">
        <span className="routine-card__pill">
          {t("routine_card.exercises_count", { count })}
        </span>
        <span className="routine-card__pill">
          {Math.round(routine.time ?? 0)}s
        </span>
      </div>
      {routine.stats?.muscleGroups?.length ? (
        <div className="routine-card__tags">
          {routine.stats.muscleGroups.slice(0, 3).map((mg) => (
            <span key={mg} className="routine-card__tag">
              {mg}
            </span>
          ))}
          {routine.stats.muscleGroups.length > 3 && (
            <span className="routine-card__tag">
              +{routine.stats.muscleGroups.length - 3}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
