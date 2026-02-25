import type { Routine } from "../types/exercise";
import SelectableCard from "./SelectableCard";
import "./RoutineCard.scss";

interface RoutineCardProps {
  routine: Routine;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDelete?: () => void;
}

export default function RoutineCard({
  routine,
  isSelected,
  onClick,
  onDoubleClick,
  onDelete,
}: RoutineCardProps) {
  const count = routine.items?.length ?? routine.exercises?.length ?? 0;

  return (
    <SelectableCard
      selected={!!isSelected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="routine-card"
    >
      {onDelete ? (
        <button
          type="button"
          className="routine-card__delete"
          aria-label="Eliminar rutina"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
          }}
        >
          ×
        </button>
      ) : null}
      <h3 className="routine-card__title">{routine.name || "Sin nombre"}</h3>
      <p className="routine-card__description">{routine.description || "Sin descripción"}</p>
      <div className="routine-card__meta">
        <span className="routine-card__pill">{count} ejercicios</span>
        <span className="routine-card__pill">{Math.round(routine.time ?? 0)}s</span>
      </div>
      {routine.stats?.muscleGroups?.length ? (
        <div className="routine-card__tags">
          {routine.stats.muscleGroups.slice(0, 3).map((mg) => (
            <span key={mg} className="routine-card__tag">
              {mg}
            </span>
          ))}
          {routine.stats.muscleGroups.length > 3 && (
            <span className="routine-card__tag">+{routine.stats.muscleGroups.length - 3}</span>
          )}
        </div>
      ) : null}
    </SelectableCard>
  );
}
