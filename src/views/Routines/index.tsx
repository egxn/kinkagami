import "./Routines.scss";
import { useNavigate } from "react-router-dom";
import RoutineCard from "../../components/RoutineCard";
import { useRoutines } from "../../hooks/useRoutines";
import type { Routine } from "../../types/exercise";
import { useRoutine } from "../../context/useRoutine";
import { logger } from "../../utils/logger";

const INITIAL_ROUTINES_COUNT = 10;

interface RoutinesViewProps {
  routines: Routine[];
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function RoutinesView({ routines, loading, error, onRetry }: RoutinesViewProps) {
  const navigate = useNavigate();
  const { setSelectedRoutine } = useRoutine();
  const routinesToRender = routines.slice(0, INITIAL_ROUTINES_COUNT);

  logger.log("RoutinesView", "Render state", {
    loading,
    hasError: !!error,
    routinesCount: routines.length,
    routinesToRenderCount: routinesToRender.length,
  });

  return (
    <div className="routines-view">
      <div className="routines-view__scroll">
        <div className="routines-view__header">
          <h1>Rutinas</h1>
        </div>

        {loading ? (
          <div className="routines-view__loading">Cargando rutinas...</div>
        ) : error ? (
          <div className="routines-view__empty">
            Error cargando rutinas: {error.message}
            {onRetry ? (
              <div>
                <button type="button" onClick={onRetry}>
                  Reintentar
                </button>
              </div>
            ) : null}
          </div>
        ) : routinesToRender.length === 0 ? (
          <div className="routines-view__empty">No hay rutinas guardadas</div>
        ) : (
          <div className="routines-view__grid">
            {routinesToRender.map((routine) => {
              const id = routine._id ?? routine.name;
              return (
                <RoutineCard
                  key={id}
                  routine={routine}
                  onDoubleClick={() => {
                    setSelectedRoutine(routine);
                    navigate("/stack/session");
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <button
        className="routines-view__new-btn"
        onClick={() => navigate("/stack/exercises")}
      >
        Nueva rutina
      </button>

    </div>
  );
}

export default function Routines() {
  const { routines, loading, error, refreshRoutines } = useRoutines();
  return (
    <RoutinesView
      routines={routines}
      loading={loading}
      error={error}
      onRetry={() => {
        void refreshRoutines();
      }}
    />
  );
}
