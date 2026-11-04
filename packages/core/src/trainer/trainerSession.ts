import type { Routine, RoutineExerciseItem } from "../exercise/types";

/** Score (0–100) at which a repetition counts as completed. */
export const SCORE_THRESHOLD = 80;
/** Score must fall to this level before another repetition can be counted. */
export const SCORE_RELEASE_THRESHOLD = 70;

/**
 * Pure state machine for routine execution: which exercise/rep the user is
 * on, and when a score completes a rep, an exercise, or the whole routine.
 * Shared by every client; the clients only react to the returned event.
 */
export interface TrainerSessionState {
  exerciseIndex: number;
  repCount: number;
  routineCompleted: boolean;
  /** Hysteresis lock: set after a completion, cleared when score drops. */
  repLocked: boolean;
}

export type TrainerSessionEvent =
  | { type: "none" }
  | { type: "rep_completed"; repCount: number }
  | { type: "exercise_completed"; nextExerciseIndex: number }
  | { type: "routine_completed" };

export interface TrainerSessionStep {
  state: TrainerSessionState;
  event: TrainerSessionEvent;
}

export const createTrainerSession = (): TrainerSessionState => ({
  exerciseIndex: 0,
  repCount: 0,
  routineCompleted: false,
  repLocked: false,
});

/** Items for a routine, falling back to the legacy `exercises` id list. */
export const resolveRoutineItems = (
  routine: Pick<Routine, "items" | "exercises"> | null | undefined,
): RoutineExerciseItem[] => {
  if (!routine) return [];
  if (routine.items && routine.items.length > 0) return routine.items;
  return (routine.exercises ?? []).map((exerciseId) => ({
    exerciseId,
    reps: 1,
  }));
};

export const getTargetReps = (item: RoutineExerciseItem | undefined): number =>
  Math.max(1, item?.reps ?? 1);

export interface TrainerStepOptions {
  /** False while no exercise is running; completions are then ignored. */
  canComplete: boolean;
}

/**
 * Advances the session for a new score. Returns the same `state` reference
 * when nothing changed, so callers can use it directly in effect deps.
 */
export const stepTrainerSession = (
  state: TrainerSessionState,
  scorePercent: number,
  items: RoutineExerciseItem[],
  { canComplete }: TrainerStepOptions,
): TrainerSessionStep => {
  if (scorePercent <= SCORE_RELEASE_THRESHOLD && state.repLocked) {
    return {
      state: { ...state, repLocked: false },
      event: { type: "none" },
    };
  }

  const activeItem = items[state.exerciseIndex];
  if (
    !canComplete ||
    state.routineCompleted ||
    !activeItem ||
    state.repLocked ||
    scorePercent < SCORE_THRESHOLD
  ) {
    return { state, event: { type: "none" } };
  }

  const nextRepCount = state.repCount + 1;
  if (nextRepCount < getTargetReps(activeItem)) {
    return {
      state: { ...state, repCount: nextRepCount, repLocked: true },
      event: { type: "rep_completed", repCount: nextRepCount },
    };
  }

  if (state.exerciseIndex < items.length - 1) {
    const nextExerciseIndex = state.exerciseIndex + 1;
    return {
      state: {
        ...state,
        exerciseIndex: nextExerciseIndex,
        repCount: 0,
        repLocked: true,
      },
      event: { type: "exercise_completed", nextExerciseIndex },
    };
  }

  return {
    state: { ...state, routineCompleted: true, repLocked: true },
    event: { type: "routine_completed" },
  };
};
