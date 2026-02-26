import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Exercise } from "../../types/exercise";
import {
  getAllExercises,
  addRoutine,
  calculateRoutineStats,
  getExerciseById,
} from "../../db/dbService";
import ExerciseCard from "../../components/ExerciseCard";
import { logger } from "../../utils/logger";
import "./Exercises.scss";

const INITIAL_EXERCISES_COUNT = 10;

interface ExercisesProps {
  onRoutineCreated?: () => void | Promise<void>;
}

export default function Exercises({ onRoutineCreated }: ExercisesProps) {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedRepsById, setSelectedRepsById] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selectedRepsById),
    [selectedRepsById],
  );
  const selectedCount = selectedIds.length;

  const initialExercises = useMemo(
    () => exercises.slice(0, INITIAL_EXERCISES_COUNT),
    [exercises],
  );

  // Load exercises from database
  useEffect(() => {
    const loadExercises = async () => {
      try {
        setLoading(true);
        const allExercises = await getAllExercises();
        setExercises(allExercises);
        logger.log("Exercises", `Loaded ${allExercises.length} exercises`);
      } catch (error) {
        logger.error("Exercises", "Error loading exercises:", error);
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, []);

  // Toggle exercise selection
  const handleExerciseClick = (exerciseId: string | undefined) => {
    if (!exerciseId) return;

    setSelectedRepsById((prev) => {
      const next = { ...prev };
      if (exerciseId in next) {
        delete next[exerciseId];
        return next;
      }

      const ex = exercises.find((e) => e._id === exerciseId || e.exercise_id === exerciseId);
      const defaultReps = Math.max(1, ex?.reps ?? 10);
      next[exerciseId] = defaultReps;
      return next;
    });
  };

  // Create routine from selected exercises
  const handleCreateRoutine = async () => {
    if (selectedCount === 0) return;

    try {
      setSaving(true);

      // Get full exercise objects for stats calculation
      const selectedExercises: Exercise[] = [];
      for (const id of selectedIds) {
        try {
          const exercise = await getExerciseById(id);
          selectedExercises.push(exercise);
        } catch {
          // Exercise might be using _id or exercise_id
          const exercise = exercises.find(
            (e) => e._id === id || e.exercise_id === id
          );
          if (exercise) selectedExercises.push(exercise);
        }
      }

      const { stats, totalTime } = calculateRoutineStats(selectedExercises);

      await addRoutine({
        name: `Rutina ${new Date().toLocaleDateString()}`,
        description: `${selectedExercises.length} ejercicios`,
        exercises: selectedIds,
        items: selectedIds.map((exerciseId) => ({
          exerciseId,
          reps: Math.max(1, selectedRepsById[exerciseId] ?? 1),
        })),
        time: totalTime,
        stats,
        created_at: new Date().toISOString(),
      });

      if (onRoutineCreated) {
        await onRoutineCreated();
      }

      logger.log(
        "Exercises",
        `Created routine with ${selectedCount} exercises`
      );

      // Clear selection after saving
      setSelectedRepsById({});
      setPanelOpen(false);
      navigate("/stack/routines");
    } catch (error) {
      logger.error("Exercises", "Error creating routine:", error);
    } finally {
      setSaving(false);
    }
  };

  const selectedExerciseSummaries = useMemo(() => {
    return selectedIds
      .map((id) => {
        const ex = exercises.find((e) => e._id === id || e.exercise_id === id);
        return {
          id,
          name: ex?.name ?? "Sin nombre",
          reps: selectedRepsById[id] ?? 1,
        };
      })
      .filter(Boolean);
  }, [exercises, selectedIds, selectedRepsById]);

  return (
    <div className="exercises-view">
      <div className="exercises-view__header">
        <button
          type="button"
          className="exercises-view__routine-btn"
          onClick={() => setPanelOpen((v) => !v)}
        >
          Rutina {selectedCount > 0 ? `(${selectedCount})` : ""}
        </button>
      </div>

      <div className="exercises-view__scroll">
        {loading ? (
          <div className="exercises-view__loading">Cargando ejercicios...</div>
        ) : initialExercises.length === 0 ? (
          <div className="exercises-view__empty">
            No hay ejercicios disponibles
          </div>
        ) : (
          <div className="exercises-view__grid">
            {initialExercises.map((exercise) => {
              const id = exercise._id || exercise.exercise_id || "";
              return (
                <ExerciseCard
                  key={id}
                  exercise={exercise}
                  isSelected={id in selectedRepsById}
                  onClick={() => handleExerciseClick(id)}
                  reps={selectedRepsById[id]}
                  onRepsChange={(nextReps) => {
                    setSelectedRepsById((prev) => {
                      if (!(id in prev)) return prev;
                      return { ...prev, [id]: Math.max(1, nextReps) };
                    });
                  }}
                />
              );
            })}
          </div>
        )}

      </div>

      {/* Side panel */}
      {panelOpen && (
        <div className="exercises-view__panel" role="dialog" aria-label="Rutina en progreso">
          <div className="exercises-view__panel-header">
            <h2>Rutina en progreso</h2>
            <button
              type="button"
              className="exercises-view__panel-close"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </div>

          {selectedCount === 0 ? (
            <div className="exercises-view__panel-empty">No hay ejercicios seleccionados</div>
          ) : (
            <div className="exercises-view__panel-list">
              {selectedExerciseSummaries.map((item) => (
                <div key={item.id} className="exercises-view__panel-item">
                  <div className="exercises-view__panel-item-main">
                    <div className="exercises-view__panel-item-title">{item.name}</div>
                    <div className="exercises-view__panel-item-meta">Reps: {item.reps}</div>
                  </div>
                  <button
                    type="button"
                    className="exercises-view__panel-remove"
                    onClick={() => {
                      setSelectedRepsById((prev) => {
                        const next = { ...prev };
                        delete next[item.id];
                        return next;
                      });
                    }}
                    aria-label="Quitar ejercicio"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="exercises-view__panel-footer">
            <button
              type="button"
              className="exercises-view__create-btn"
              onClick={handleCreateRoutine}
              disabled={saving || selectedCount === 0}
            >
              {saving ? "Guardando..." : "Crear"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
