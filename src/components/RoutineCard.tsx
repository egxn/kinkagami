import type { Routine } from "../types/exercise";
import { RoutineCard as RoutineCardUI } from "../ui";
import Button from "./Button";
import usePoseContext from "../context/usePoseContext";
import { logger } from "../utils/logger";

interface RoutineCardProps {
  routine: Routine;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDiscard?: () => void;
}

export default function RoutineCard({
  routine,
  isSelected,
  onClick,
  onDoubleClick,
  onDiscard,
}: RoutineCardProps) {
  const { videoRef, streamReady } = usePoseContext();
  const handleAction = onDoubleClick ?? onClick ?? (() => {});

  return (
    <Button
      videoRef={videoRef}
      streamReady={streamReady}
      onAction={handleAction}
      requireSecondFistForAction
      onDiscard={() => {
        if (onDiscard) {
          onDiscard();
          return;
        }
        logger.log("RoutineCard", "Routine action discarded");
      }}
      alignX="left"
      style={{
        width: "100%",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }}
    >
      <RoutineCardUI routine={routine} isSelected={isSelected} />
    </Button>
  );
}
