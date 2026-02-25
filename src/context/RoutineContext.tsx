import React, { useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { RoutineContext } from "./RoutineContextDef";
import type { RoutineItem } from "./RoutineContextDef";
import type { Routine } from "../types/exercise";

export {
  RoutineContext,
  type RoutineItem,
  type RoutineContextType,
} from "./RoutineContextDef";

export const RoutineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [routine, setRoutine] = useState<RoutineItem[]>(() => {
    try {
      const stored = localStorage.getItem("user_routine");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load routine from local storage", e);
      return [];
    }
  });

  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(() => {
    try {
      const stored = localStorage.getItem("selected_routine");
      return stored ? (JSON.parse(stored) as Routine) : null;
    } catch (e) {
      console.error("Failed to load selected routine from local storage", e);
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem("user_routine", JSON.stringify(routine));
  }, [routine]);

  useEffect(() => {
    if (!selectedRoutine) {
      localStorage.removeItem("selected_routine");
      return;
    }
    localStorage.setItem("selected_routine", JSON.stringify(selectedRoutine));
  }, [selectedRoutine]);

  const addToRoutine = (exerciseId: string, reps = 10, sets = 3) => {
    const newItem: RoutineItem = {
      id: crypto.randomUUID(),
      exerciseId,
      reps,
      sets,
    };
    setRoutine((prev) => [...prev, newItem]);
  };

  const removeFromRoutine = (id: string) => {
    setRoutine((prev) => prev.filter((item) => item.id !== id));
  };

  const reorderRoutine = (fromIndex: number, toIndex: number) => {
    setRoutine((prev) => arrayMove(prev, fromIndex, toIndex));
  };

  const updateRoutineItem = (id: string, updates: Partial<RoutineItem>) => {
    setRoutine((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  return (
    <RoutineContext.Provider
      value={{
        routine,
        addToRoutine,
        removeFromRoutine,
        reorderRoutine,
        updateRoutineItem,
        selectedRoutine,
        setSelectedRoutine,
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
};
