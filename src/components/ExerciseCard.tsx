import type { Exercise } from "../types/exercise";
import { ExerciseCard as ExerciseCardUI } from "../ui";
import Button from "./Button";
import usePoseContext from "../context/usePoseContext";
import { logger } from "../utils/logger";

interface ExerciseCardProps {
  exercise: Exercise;
  isSelected: boolean;
  onClick: () => void;
}

export default function ExerciseCard({
  exercise,
  isSelected,
  onClick,
}: ExerciseCardProps) {
  const { videoRef, streamReady } = usePoseContext();

  return (
    <Button
      videoRef={videoRef}
      streamReady={streamReady}
      onAction={() => {
        if (!isSelected) onClick();
      }}
      onDiscard={() => {
        logger.log("ExerciseCard", "Exercise action discarded");
      }}
      alignX="left"
      style={{
        width: "100%",
        justifyContent: "flex-start",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }}
    >
      <ExerciseCardUI exercise={exercise} isSelected={isSelected} />
    </Button>
  );
}
