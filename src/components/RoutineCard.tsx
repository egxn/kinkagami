import type { Routine } from "../types/exercise";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import usePoseContext from "../context/usePoseContext";
import { logger } from "../utils/logger";
import "./RoutineCard.scss";

interface RoutineCardProps {
  routine: Routine;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDiscard?: () => void;
}

export default function RoutineCard({
  routine,
  isSelected,
  onClick,
  onDoubleClick,
  onDiscard,
}: RoutineCardProps) {
  const { t } = useTranslation();
  const { videoRef, streamReady } = usePoseContext();
  const count = routine.items?.length ?? routine.exercises?.length ?? 0;
  const handleAction = onDoubleClick ?? onClick ?? (() => {});

  return (
    <Button
      videoRef={videoRef}
      streamReady={streamReady}
      onAction={handleAction}
      requireSecondFistForAction
      onDiscard={() => {
        if (onDiscard) {
          onDiscard();
          return;
        }
        logger.log("RoutineCard", "Routine action discarded");
      }}
      alignX="left"
      style={{
        width: "100%",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }}
    >
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
    </Button>
  );
}
