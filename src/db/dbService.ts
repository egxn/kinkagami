import PouchDB from 'pouchdb';

// Inicializar la base de datos
export const exercisesDB = new PouchDB('exercises');

export interface Exercise {
  _id?: string;
  _rev?: string;
  name: string;
  description: string;
  sets?: number;
  reps?: number;
  duration?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Cargar un ejercicio desde JSON ubicado en src/db/exercises/
 * 
 * Estrategia de carga:
 * - Los archivos JSON se importan dinámicamente usar import()
 * - Los ejercicios se cargan en PouchDB en la inicialización
 * - La DB actúa como cache local
 * 
 * @example
 * // Importar un ejercicio específico
 * const exercise = await loadExerciseFromJSON('00_sample');
 * 
 * @param exerciseFileName - Nombre del archivo sin extensión (ej: '00_sample')
 */
export async function loadExerciseFromJSON(exerciseFileName: string) {
  try {
    // Usar glob import pattern de Vite para cargar JSON dinámicamente
    const module = await import(`./exercises/${exerciseFileName}.json`);
    const exerciseData = module.default;
    
    console.log(`Ejercicio cargado: ${exerciseData.exercise_id}`);
    return exerciseData;
  } catch (error) {
    console.error(`Error loading exercise ${exerciseFileName}:`, error);
    throw error;
  }
}

/**
 * Importar todos los ejercicios desde src/db/exercises/ a PouchDB
 * Nota: Vite necesita configuración especial en vite.config.ts para importar JSONs
 * 
 * Alternativa: Configurar vite.config.ts con:
 * ```ts
 * import { defineConfig } from 'vite'
 * import react from '@vitejs/plugin-react-swc'
 * 
 * export default defineConfig({
 *   plugins: [react()],
 *   ssr: {
 *     external: ['pouchdb']
 *   }
 * })
 * ```
 */
export async function importExercisesFromJSON(exerciseFileNames: string[]) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as { fileName: string; error: string }[],
  };

  try {
    for (const fileName of exerciseFileNames) {
      try {
        const exerciseData = await loadExerciseFromJSON(fileName);
        const exercise: Omit<Exercise, '_id' | '_rev'> = {
          name: exerciseData.name || 'Ejercicio sin nombre',
          description: exerciseData.description || '',
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          duration: exerciseData.duration,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        await addExercise(exercise);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`✗ Error importing ${fileName}:`, error);
      }
    }

    console.log(
      `✓ Importación completada: ${results.success} exitosos, ${results.failed} fallidos`
    );
    
    if (results.errors.length > 0) {
      console.warn('Errores de importación:', results.errors);
    }

    return results;
  } catch (error) {
    console.error('Error importing exercises from JSON:', error);
    throw error;
  }
}

/**
 * Agregar un nuevo ejercicio a la base de datos
 */
export async function addExercise(exercise: Omit<Exercise, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) {
  const doc: Exercise = {
    ...exercise,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  try {
    const result = await exercisesDB.post(doc);
    return { success: true, id: result.id, rev: result.rev };
  } catch (error) {
    console.error('Error adding exercise:', error);
    throw error;
  }
}

/**
 * Obtener todos los ejercicios
 */
export async function getAllExercises(): Promise<Exercise[]> {
  try {
    const result = await exercisesDB.allDocs({ include_docs: true });
    return result.rows
      .map((row) => row.doc as Exercise)
      .filter((doc): doc is Exercise => !!doc);
  } catch (error) {
    console.error('Error getting exercises:', error);
    throw error;
  }
}

/**
 * Obtener un ejercicio por ID
 */
export async function getExerciseById(id: string): Promise<Exercise> {
  try {
    const doc = await exercisesDB.get(id);
    return doc as Exercise;
  } catch (error) {
    console.error('Error getting exercise:', error);
    throw error;
  }
}

/**
 * Actualizar un ejercicio
 */
export async function updateExercise(id: string, updates: Partial<Exercise>) {
  try {
    const doc = await exercisesDB.get(id);
    const updated = {
      ...doc,
      ...updates,
      updatedAt: Date.now(),
    };
    const result = await exercisesDB.put(updated);
    return { success: true, rev: result.rev };
  } catch (error) {
    console.error('Error updating exercise:', error);
    throw error;
  }
}

/**
 * Eliminar un ejercicio
 */
export async function deleteExercise(id: string) {
  try {
    const doc = await exercisesDB.get(id);
    await exercisesDB.remove(doc);
    return { success: true };
  } catch (error) {
    console.error('Error deleting exercise:', error);
    throw error;
  }
}

/**
 * Sincronizar con un servidor remoto
 */
export async function syncWithRemote(remoteUrl: string) {
  try {
    const remoteDB = new PouchDB(remoteUrl);
    const result = await exercisesDB.sync(remoteDB, { live: false, retry: false });
    return result;
  } catch (error) {
    console.error('Error syncing with remote:', error);
    throw error;
  }
}

/**
 * Limpiar la base de datos (borrar todos los documentos)
 */
export async function clearDatabase() {
  try {
    const result = await exercisesDB.destroy();
    return result;
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
}
