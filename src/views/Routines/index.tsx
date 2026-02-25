import "./Routines.scss";
import { useNavigate } from "react-router-dom";
import RoutineCard from "../../components/RoutineCard";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useRoutines } from "../../hooks/useRoutines";
import type { Routine } from "../../types/exercise";
import { useRoutine } from "../../context/useRoutine";

interface RoutinesViewProps {
  routines: Routine[];
  loading: boolean;
  onDeleteRoutine?: (id: string) => void;
}

export function RoutinesView({
  routines,
  loading,
  onDeleteRoutine,
}: RoutinesViewProps) {
  const navigate = useNavigate();
  const { setSelectedRoutine } = useRoutine();
  const { displayedItems, sentinelRef, loadingMore } = useInfiniteScroll(
    routines,
    10,
  );

  return (
    <div className="routines-view">
      <div className="routines-view__scroll">
        <div className="routines-view__header">
          <h1>Rutinas</h1>
        </div>

        {loading ? (
          <div className="routines-view__loading">Cargando rutinas...</div>
        ) : displayedItems.length === 0 ? (
          <div className="routines-view__empty">No hay rutinas guardadas</div>
        ) : (
          <div className="routines-view__grid">
            {displayedItems.map((routine) => {
              const id = routine._id ?? routine.name;
              return (
                <RoutineCard
                  key={id}
                  routine={routine}
                  onDoubleClick={() => {
                    setSelectedRoutine(routine);
                    navigate("/stack/session");
                  }}
                  onDelete={() => {
                    if (!routine._id) return;
                    onDeleteRoutine?.(routine._id);
                  }}
                />
              );
            })}
          </div>
        )}

        <div ref={sentinelRef} className="routines-view__sentinel">
          {loadingMore && <span>Cargando más...</span>}
        </div>
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
  const { routines, loading } = useRoutines();
  return <RoutinesView routines={routines} loading={loading} />;
}
