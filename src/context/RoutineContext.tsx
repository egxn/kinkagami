import React, { createContext, useContext, useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";

export interface RoutineItem {
  id: string; // unique instance ID for the routine
  exerciseId: string;
  reps: number;
  sets: number;
}

interface RoutineContextType {
  routine: RoutineItem[];
  addToRoutine: (exerciseId: string, reps?: number, sets?: number) => void;
  removeFromRoutine: (id: string) => void;
  reorderRoutine: (fromIndex: number, toIndex: number) => void;
  updateRoutineItem: (id: string, updates: Partial<RoutineItem>) => void;
}

const RoutineContext = createContext<RoutineContextType | undefined>(undefined);

export const useRoutine = () => {
  const context = useContext(RoutineContext);
  if (!context) {
    throw new Error("useRoutine must be used within a RoutineProvider");
  }
  return context;
};

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

  useEffect(() => {
    localStorage.setItem("user_routine", JSON.stringify(routine));
  }, [routine]);

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
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
};
