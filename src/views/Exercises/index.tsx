import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Exercise } from "../../types/exercise";
import {
  getAllExercises,
  addRoutine,
  calculateRoutineStats,
  getExerciseById,
} from "../../db/dbService";
import ExerciseCard from "../../components/ExerciseCard";
import CardLayout from "../../components/CardLayout";
import Button from "../../components/Button";
import usePoseContext from "../../context/usePoseContext";
import { usePagedCarousel } from "../../hooks";
import { logger } from "../../utils/logger";
import "./Exercises.scss";

const EXERCISES_PER_PAGE = 3;

interface ExercisesProps {
  onRoutineCreated?: () => void | Promise<void>;
}

export default function Exercises({ onRoutineCreated }: ExercisesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { videoRef, streamReady } = usePoseContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedRepsById, setSelectedRepsById] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    pageItems: visibleExercises,
    startIndex,
    hasPrevious,
    hasNext,
    transitionDirection,
    goPrevious,
    goNext,
  } = usePagedCarousel(exercises, EXERCISES_PER_PAGE);

  const selectedIds = useMemo(
    () => Object.keys(selectedRepsById),
    [selectedRepsById],
  );
  const selectedCount = selectedIds.length;

  const visibleSlots = [
    visibleExercises[0] ?? null,
    visibleExercises[1] ?? null,
    visibleExercises[2] ?? null,
  ] as const;

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

  const slotNodes = visibleSlots.map((exercise) =>
    exercise ? (
      <ExerciseCard
        exercise={exercise}
        isSelected={
          (exercise._id || exercise.exercise_id || "") in selectedRepsById
        }
        onClick={() =>
          handleExerciseClick(exercise._id || exercise.exercise_id || "")
        }
      />
    ) : null,
  );

  const actionSlotNodes = visibleSlots.map((exercise) => {
    if (!exercise) return null;

    const id = exercise._id || exercise.exercise_id || "";
    if (!id || !(id in selectedRepsById)) return null;
    const currentReps = Math.max(1, selectedRepsById[id] ?? exercise.reps ?? 1);

    return (
      <Button
        videoRef={videoRef}
        streamReady={streamReady}
        onAction={() => {
          setSelectedRepsById((prev) => {
            if (!(id in prev)) return prev;
            return { ...prev, [id]: Math.max(1, prev[id] + 1) };
          });
        }}
        onDiscard={() =>
          logger.log("Exercises", "Increment reps action discarded", {
            exerciseId: id,
          })
        }
        alignX="center"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          borderTop: "none",
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        <div>{t("exercises.reps_plus", { count: currentReps })}</div>
      </Button>
    );
  });

  // Toggle exercise selection
  const handleExerciseClick = (exerciseId: string | undefined) => {
    if (!exerciseId) return;

    setSelectedRepsById((prev) => {
      const next = { ...prev };
      if (exerciseId in next) {
        delete next[exerciseId];
        return next;
      }

      const ex = exercises.find(
        (e) => e._id === exerciseId || e.exercise_id === exerciseId,
      );
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
            (e) => e._id === id || e.exercise_id === id,
          );
          if (exercise) selectedExercises.push(exercise);
        }
      }

      const { stats, totalTime } = calculateRoutineStats(selectedExercises);

      await addRoutine({
        name: t("exercises.routine_name", {
          date: new Date().toLocaleDateString(),
        }),
        description: t("exercises.routine_description", {
          count: selectedExercises.length,
        }),
        exercises: selectedIds,
        items: selectedIds.map((exerciseId: string) => ({
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
        `Created routine with ${selectedCount} exercises`,
      );

      // Clear selection after saving
      setSelectedRepsById({});
      navigate("/stack/routines");
    } catch (error) {
      logger.error("Exercises", "Error creating routine:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardLayout
      className="exercises-view"
      title={t("exercises.title")}
      loading={loading}
      isEmpty={visibleExercises.length === 0}
      loadingMessage={t("exercises.loading")}
      emptyMessage={t("exercises.empty")}
      errorPrefix={t("exercises.error_prefix")}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      onPrevious={goPrevious}
      onNext={goNext}
      slots={slotNodes}
      actionSlots={actionSlotNodes}
      transitionDirection={transitionDirection}
      transitionKey={startIndex}
      navSlotWidth={220}
      cardSlotFlex={1.2}
      cardSlotHeightPercent={78}
      actionSlotHeightPercent={22}
      navButtonSize={200}
      footerButtonLabel={
        saving
          ? t("exercises.saving")
          : t("exercises.create_routine", { count: selectedCount })
      }
      footerButtonOnAction={() => {
        void handleCreateRoutine();
      }}
      footerButtonOnDiscard={() =>
        logger.log("Exercises", "Create routine action discarded")
      }
      footerButtonClassName="exercises-view__create-btn"
      footerButtonWidth="80%"
      footerButtonMinHeight={112}
      footerButtonDisabled={saving || selectedCount === 0}
    />
  );
}
