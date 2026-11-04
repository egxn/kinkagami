import type { Exercise, Routine } from "@kgm/core";

export interface ClassifiedDocuments {
  exercises: Exercise[];
  routines: Routine[];
  skipped: number;
}

type AnyDoc = Record<string, unknown>;

const isObject = (value: unknown): value is AnyDoc =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const looksLikeExercise = (doc: AnyDoc) =>
  isObject(doc.signals) ||
  isObject(doc.event_graph) ||
  Array.isArray(doc.recording_points) ||
  Array.isArray(doc.recording_angles);

const looksLikeRoutine = (doc: AnyDoc) =>
  !looksLikeExercise(doc) &&
  (Array.isArray(doc.items) || Array.isArray(doc.exercises));

/**
 * Sorts parsed JSON into exercises and routines. Accepts a single document,
 * an array, or a bundle `{ exercises: [...objects], routines: [...] }`.
 */
export function classifyDocuments(input: unknown): ClassifiedDocuments {
  const out: ClassifiedDocuments = { exercises: [], routines: [], skipped: 0 };

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isObject(value)) {
      out.skipped += 1;
      return;
    }

    // Bundle: `exercises` holds objects (a routine's `exercises` holds ids).
    const bundled =
      Array.isArray(value.exercises) && value.exercises.some(isObject);
    if (bundled || Array.isArray(value.routines)) {
      if (Array.isArray(value.exercises)) value.exercises.forEach(visit);
      if (Array.isArray(value.routines)) value.routines.forEach(visit);
      return;
    }

    if (looksLikeExercise(value))
      out.exercises.push(value as unknown as Exercise);
    else if (looksLikeRoutine(value))
      out.routines.push(value as unknown as Routine);
    else out.skipped += 1;
  };

  visit(input);
  return out;
}
