import { createContext } from "react";
import type { Routine } from "../types/exercise";

export interface RoutineItem {
  id: string; // unique instance ID for the routine
  exerciseId: string;
  reps: number;
  sets: number;
}

export interface RoutineContextType {
  routine: RoutineItem[];
  addToRoutine: (exerciseId: string, reps?: number, sets?: number) => void;
  removeFromRoutine: (id: string) => void;
  reorderRoutine: (fromIndex: number, toIndex: number) => void;
  updateRoutineItem: (id: string, updates: Partial<RoutineItem>) => void;

  /** Routine selected from DB (saved routines) */
  selectedRoutine: Routine | null;
  setSelectedRoutine: (routine: Routine | null) => void;
}

export const RoutineContext = createContext<RoutineContextType | undefined>(
  undefined,
);
