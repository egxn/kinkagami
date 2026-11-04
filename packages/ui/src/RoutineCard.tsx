import type { Routine } from "@kgm/core";
import "./RoutineCard.scss";

export interface RoutineCardLabels {
  unnamed?: string;
  noDescription?: string;
  /** Formats the "N exercises" pill. */
  exercisesCount?: (count: number) => string;
}

export interface RoutineCardProps {
  labels?: RoutineCardLabels;
  routine: Routine;
  isSelected?: boolean;
}

export default function RoutineCard({
  routine,
  isSelected,
  labels,
}: RoutineCardProps) {
  const count = routine.items?.length ?? routine.exercises?.length ?? 0;

  return (
    <div
      className={`routine-card ${isSelected ? "routine-card--selected" : ""}`}
    >
      <h3 className="routine-card__title">
        {routine.name || (labels?.unnamed ?? "Sin nombre")}
      </h3>
      <p className="routine-card__description">
        {routine.description || (labels?.noDescription ?? "Sin descripción")}
      </p>
      <div className="routine-card__meta">
        <span className="routine-card__pill">
          {labels?.exercisesCount?.(count) ?? `${count} ejercicios`}
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
