import { useEffect, useMemo, useState } from "react";
import Skeleton from "../../../components/Skeleton";
import {
  createBoxRivalPattern,
  getBoxRivalColors,
  type BoxTimelineFrame,
  type BoxDifficulty,
  type BoxGearOptions,
  type BoxPunch,
  type BoxRivalPalette,
} from "./box_gear";

interface BoxRivalProps {
  difficulty?: BoxDifficulty;
  className?: string;
  roundDurationSeconds?: number;
  totalPunches?: number;
  seed?: number;
  punchSequence?: BoxPunch[];
  rivalPhysique?: BoxGearOptions["rivalPhysique"];
  rivalPalette?: BoxRivalPalette;
  onFrameChange?: (frame: BoxTimelineFrame) => void;
  paused?: boolean;
}

export default function BoxRival({
  difficulty = "intermedio",
  className,
  roundDurationSeconds = 45,
  totalPunches,
  seed,
  punchSequence,
  rivalPhysique = "middleweight",
  rivalPalette = "arcade",
  onFrameChange,
  paused = false,
}: BoxRivalProps) {
  const pattern = useMemo(
    () =>
      createBoxRivalPattern(difficulty, {
        punchSequence,
        rivalPhysique,
        roundDurationSeconds,
        seed,
        totalPunches,
      }),
    [difficulty, punchSequence, rivalPhysique, roundDurationSeconds, seed, totalPunches],
  );
  const exercise = pattern.exercise;
  const colors = useMemo(() => getBoxRivalColors(rivalPalette), [rivalPalette]);
  const [frameIndex, setFrameIndex] = useState(0);
  const totalFrames = exercise.recording_points.length;
  const frameDelayMs = Math.max(
    1,
    Math.round(((exercise.duration ?? 1) * 1000) / Math.max(totalFrames, 1)),
  );
  const currentFrameIndex = frameIndex % Math.max(totalFrames, 1);

  useEffect(() => {
    if (paused || totalFrames <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % totalFrames);
    }, frameDelayMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [frameDelayMs, paused, totalFrames]);

  useEffect(() => {
    onFrameChange?.(
      pattern.timeline[currentFrameIndex] ?? {
        phase: "idle",
        punch: null,
        punchIndex: null,
        impact: false,
        defenseHint: null,
      },
    );
  }, [currentFrameIndex, onFrameChange, pattern.timeline]);

  return (
    <Skeleton
      className={className}
      autoSize
      exercise={exercise}
      frameIndex={currentFrameIndex}
      colors={colors}
      poseModel="movenet"
    />
  );
}
