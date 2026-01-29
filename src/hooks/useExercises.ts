import { useState, useEffect, useCallback } from 'react';
import type { Exercise } from '../db/dbService';
import { getAllExercises, addExercise, updateExercise, deleteExercise } from '../db/dbService';

export interface UseExercisesResult {
  exercises: Exercise[];
  loading: boolean;
  error: Error | null;
  addNewExercise: (exercise: Omit<Exercise, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateExerciseData: (id: string, updates: Partial<Exercise>) => Promise<void>;
  deleteExerciseData: (id: string) => Promise<void>;
  refreshExercises: () => Promise<void>;
}

/**
 * Hook para gestionar ejercicios desde la base de datos PouchDB
 */
export function useExercises(): UseExercisesResult {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Obtener todos los ejercicios
  const refreshExercises = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllExercises();
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar ejercicios al montar el componente
  useEffect(() => {
    refreshExercises();
  }, [refreshExercises]);

  // Agregar nuevo ejercicio
  const addNewExercise = useCallback(
    async (exercise: Omit<Exercise, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
      try {
        setError(null);
        await addExercise(exercise);
        await refreshExercises();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      }
    },
    [refreshExercises]
  );

  // Actualizar ejercicio
  const updateExerciseData = useCallback(
    async (id: string, updates: Partial<Exercise>) => {
      try {
        setError(null);
        await updateExercise(id, updates);
        await refreshExercises();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      }
    },
    [refreshExercises]
  );

  // Eliminar ejercicio
  const deleteExerciseData = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await deleteExercise(id);
        await refreshExercises();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      }
    },
    [refreshExercises]
  );

  return {
    exercises,
    loading,
    error,
    addNewExercise,
    updateExerciseData,
    deleteExerciseData,
    refreshExercises,
  };
}
