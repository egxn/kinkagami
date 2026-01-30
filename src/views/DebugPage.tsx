import { DebugFSM } from "../components/DebugFSM";
import sample from "../db/exercises/00_sample.json";
import type { ExerciseDef } from "../types/exercise";

export default function DebugPage() {
  const exercise = sample as unknown as ExerciseDef;
  return <DebugFSM exercise={exercise} />;
}
