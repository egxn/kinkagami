import Score from "../Score";
import Trainer from "../Trainer";
import { useRoutine } from "../../context/useRoutine";

/**
 * Groups Score + Trainer while keeping Stack's `stack-layer` structure.
 * Reads the selected routine from RoutineProvider so the session can use it.
 */
export default function ScoreTrainerLayers() {
  const { selectedRoutine } = useRoutine();

  return (
    <>
      <div
        className="stack-layer"
        data-selected-routine={selectedRoutine?._id ?? ""}
      >
        <Score />
      </div>
      <div
        className="stack-layer"
        data-selected-routine-name={selectedRoutine?.name ?? ""}
      >
        <Trainer />
      </div>
    </>
  );
}
