import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/Button";
import usePoseContext from "../../../context/usePoseContext";
import Canvas from "../../Canvas";
import BoxDamageOverlay from "./BoxDamageOverlay";
import BoxRival from "./BoxRival";
import BoxRoundOverlay from "./BoxRoundOverlay";
import BoxRoundTimer from "./BoxRoundTimer";
import BoxScore from "./BoxScore";
import type {
  BoxDifficulty,
  BoxPunch,
  BoxTimelineFrame,
  BoxRivalPalette,
  BoxRivalPhysique,
} from "./box_gear";
import {
  evaluateDefense,
  getDefensePrompt,
  resolveRoundOutcome,
} from "./box_gameplay";

const BOX_SKELETON_COORDS = {
  layoutMode: "hipsBottomCenter" as const,
  style: {
    bottom: 0,
    height: "100vh",
    left: 0,
    right: 0,
    width: "100vw",
  },
};

export interface BoxProps {
  difficulty?: BoxDifficulty;
  roundDurationSeconds?: number;
  rivalPhysique?: BoxRivalPhysique;
  rivalPalette?: BoxRivalPalette;
  totalPunches?: number;
  seed?: number;
  punchSequence?: BoxPunch[];
}

const MAX_HEALTH = 100;

const RIVAL_STYLE: CSSProperties = {
  position: "absolute",
  top: "6vh",
  left: "50%",
  width: "32vw",
  height: "48vh",
  transform: "translateX(-50%)",
  pointerEvents: "none",
};

export default function Box({
  difficulty = "intermedio",
  roundDurationSeconds = 45,
  rivalPhysique = "middleweight",
  rivalPalette = "arcade",
  totalPunches,
  seed,
  punchSequence,
}: BoxProps) {
  const isDebug = import.meta.env.DEV;
  const navigate = useNavigate();
  const { videoRef, streamReady } = usePoseContext();
  const [playerPose, setPlayerPose] = useState<Pose | null>(null);
  const [currentAttackFrame, setCurrentAttackFrame] = useState<BoxTimelineFrame>({
    phase: "idle",
    punch: null,
    punchIndex: null,
    impact: false,
    defenseHint: null,
  });
  const [successfulDefenses, setSuccessfulDefenses] = useState(0);
  const [missedDefenses, setMissedDefenses] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(MAX_HEALTH);
  const [rivalHealth, setRivalHealth] = useState(MAX_HEALTH);
  const [secondsLeft, setSecondsLeft] = useState(() => roundDurationSeconds);
  const [damageOverlayTrigger, setDamageOverlayTrigger] = useState(0);
  const [lastDefenseResult, setLastDefenseResult] = useState("ready");
  const [roundInstance, setRoundInstance] = useState(0);
  const [activeSeed, setActiveSeed] = useState(() => seed ?? Date.now());
  const lastResolvedPunchRef = useRef<number | null>(null);
  const roundOutcome = useMemo(
    () =>
      resolveRoundOutcome({
        playerHealth,
        rivalHealth,
        score,
        secondsLeft,
      }),
    [playerHealth, rivalHealth, score, secondsLeft],
  );
  const isRoundActive = roundOutcome === "active";
  const displayDefenseResult = useMemo(() => {
    if (roundOutcome === "rivalKO") return "rival ko";
    if (roundOutcome === "playerKO") return "player ko";
    if (roundOutcome === "timeUpWin") return "win on points";
    if (roundOutcome === "timeUpLose") return "lose on points";
    if (roundOutcome === "timeUpDraw") return "draw";
    return lastDefenseResult;
  }, [lastDefenseResult, roundOutcome]);

  useEffect(() => {
    if (!isRoundActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRoundActive]);

  const handleDiscardRematch = useCallback(() => {}, []);
  const handleDiscardExit = useCallback(() => {}, []);

  const regenerateSeed = useCallback(
    () => Math.floor(Date.now() + Math.random() * 100000),
    [],
  );

  const handleRematch = useCallback(() => {
    setPlayerPose(null);
    setCurrentAttackFrame({
      phase: "idle",
      punch: null,
      punchIndex: null,
      impact: false,
      defenseHint: null,
    });
    setSuccessfulDefenses(0);
    setMissedDefenses(0);
    setScore(0);
    setCombo(0);
    setPlayerHealth(MAX_HEALTH);
    setRivalHealth(MAX_HEALTH);
    setSecondsLeft(roundDurationSeconds);
    setDamageOverlayTrigger(0);
    setLastDefenseResult("ready");
    setActiveSeed(regenerateSeed());
    lastResolvedPunchRef.current = null;
    setRoundInstance((current) => current + 1);
  }, [regenerateSeed, roundDurationSeconds]);

  const handleExit = useCallback(() => {
    navigate("/play");
  }, [navigate]);

  const handlePlayerPosesDetected = useCallback((poses: Pose[]) => {
    setPlayerPose(poses[0] ?? null);
  }, []);

  const handleRivalFrameChange = useCallback((frame: BoxTimelineFrame) => {
    setCurrentAttackFrame(frame);

    if (!isRoundActive) {
      return;
    }

    if (!frame.impact || frame.punchIndex === null) {
      return;
    }

    if (lastResolvedPunchRef.current === frame.punchIndex) {
      return;
    }

    lastResolvedPunchRef.current = frame.punchIndex;
    const evaluation = evaluateDefense(playerPose, frame.defenseHint);

    if (evaluation.success) {
      setSuccessfulDefenses((current) => current + 1);
      setCombo((current) => {
        const nextCombo = current + evaluation.comboDelta;
        setScore((currentScore) =>
          currentScore + evaluation.scoreDelta + nextCombo * 20,
        );
        return nextCombo;
      });
      setRivalHealth((current) =>
        Math.max(0, current - evaluation.rivalDamage),
      );
    } else {
      setMissedDefenses((current) => current + 1);
      if (evaluation.resetCombo) {
        setCombo(0);
      }
      setPlayerHealth((current) =>
        Math.max(0, current - evaluation.playerDamage),
      );
      if (evaluation.showDamageOverlay) {
        setDamageOverlayTrigger((current) => current + 1);
      }
    }

    setLastDefenseResult(evaluation.result);
  }, [isRoundActive, playerPose]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
      }}
    >
      <Canvas
        turnOffVideo
        skeletonCoords={BOX_SKELETON_COORDS}
        onPosesDetected={handlePlayerPosesDetected}
      />
      <BoxDamageOverlay trigger={damageOverlayTrigger} />
      <BoxRoundTimer active={isRoundActive} remainingSeconds={secondsLeft} />
      <BoxRoundOverlay
        outcome={roundOutcome}
        playerHealth={playerHealth}
        rivalHealth={rivalHealth}
        score={score}
        actions={
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              videoRef={videoRef}
              streamReady={streamReady}
              onAction={handleRematch}
              onDiscard={handleDiscardRematch}
              alignX="center"
              style={{ minWidth: 220 }}
            >
              <div>rematch</div>
            </Button>
            <Button
              videoRef={videoRef}
              streamReady={streamReady}
              onAction={handleExit}
              onDiscard={handleDiscardExit}
              alignX="center"
              style={{ minWidth: 220 }}
            >
              <div>back to play</div>
            </Button>
          </div>
        }
      />
      <BoxScore
        combo={combo}
        debugSeed={isDebug ? activeSeed : undefined}
        difficulty={difficulty}
        defensePrompt={getDefensePrompt(currentAttackFrame.defenseHint)}
        incomingPunch={currentAttackFrame.punch}
        lastDefenseResult={displayDefenseResult}
        missedDefenses={missedDefenses}
        playerHealth={playerHealth}
        rivalHealth={rivalHealth}
        rivalPalette={rivalPalette}
        rivalPhysique={rivalPhysique}
        remainingSeconds={secondsLeft}
        roundOutcome={roundOutcome}
        score={score}
        successfulDefenses={successfulDefenses}
      />
      <div style={RIVAL_STYLE}>
        <BoxRival
          key={roundInstance}
          difficulty={difficulty}
          punchSequence={punchSequence}
          rivalPalette={rivalPalette}
          rivalPhysique={rivalPhysique}
          roundDurationSeconds={roundDurationSeconds}
          seed={activeSeed}
          totalPunches={totalPunches}
          onFrameChange={handleRivalFrameChange}
          paused={!isRoundActive}
        />
      </div>
    </div>
  );
}
