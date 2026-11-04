import { useTranslation } from "react-i18next";
import type { Exercise } from "@kgm/core";
import { ExerciseCard as ExerciseCardUI } from "@kgm/ui";
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
  const { t } = useTranslation();
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
      <ExerciseCardUI
        exercise={exercise}
        isSelected={isSelected}
        labels={{
          unnamed: t("common.unnamed"),
          noDescription: t("common.no_description"),
        }}
      />
    </Button>
  );
}
