import type { Pose } from "@tensorflow-models/pose-detection";
import { generateEventGraph } from "../../../services/exerciseGenerator";
import type {
  BodyPart,
  Exercise,
  RecordingAngle,
  RecordingPoint,
} from "../../../types/exercise";
import { calculateAllBodyAngles } from "../../../utils/poseUtils";

export type BoxDifficulty = "beginner" | "intermedio" | "advanced";
export type BoxPunch = "jab" | "cross" | "lead_hook" | "rear_hook";
export type BoxRivalPhysique =
  | "featherweight"
  | "middleweight"
  | "heavyweight";
export type BoxRivalPalette = "arcade" | "classic" | "cyber";

export interface BoxRivalColors {
  skeleton: string;
  keypoints: string;
}

export type BoxDefenseHint = "block" | "dodgeLeft" | "dodgeRight";
export type BoxAttackPhase = "idle" | "telegraph" | "attack" | "recover";

export interface BoxTimelineFrame {
  phase: BoxAttackPhase;
  punch: BoxPunch | null;
  punchIndex: number | null;
  impact: boolean;
  defenseHint: BoxDefenseHint | null;
}

export interface BoxRivalPattern {
  exercise: Exercise;
  timeline: BoxTimelineFrame[];
  punches: BoxPunch[];
  fps: number;
}

interface BoxDifficultyConfig {
  punches: BoxPunch[];
  totalPunches: number;
  telegraphFrames: number;
  telegraphFactor: number;
  transitionFrames: number;
  holdFrames: number;
  recoveryFrames: number;
  idleFrames: number;
  fps: number;
}

export interface BoxGearOptions {
  seed?: number;
  totalPunches?: number;
  punchSequence?: BoxPunch[];
  roundDurationSeconds?: number;
  rivalPhysique?: BoxRivalPhysique;
}

type Point = { x: number; y: number };
type PoseMap = Record<BodyPart, Point>;

const KEYPOINT_ORDER: BodyPart[] = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

const BOX_DIFFICULTY_CONFIG: Record<BoxDifficulty, BoxDifficultyConfig> = {
  beginner: {
    punches: ["jab", "cross"],
    totalPunches: 4,
    telegraphFrames: 5,
    telegraphFactor: 0.28,
    transitionFrames: 6,
    holdFrames: 4,
    recoveryFrames: 6,
    idleFrames: 8,
    fps: 12,
  },
  intermedio: {
    punches: ["jab", "cross", "lead_hook"],
    totalPunches: 6,
    telegraphFrames: 4,
    telegraphFactor: 0.22,
    transitionFrames: 5,
    holdFrames: 3,
    recoveryFrames: 5,
    idleFrames: 6,
    fps: 14,
  },
  advanced: {
    punches: ["jab", "cross", "lead_hook", "rear_hook"],
    totalPunches: 8,
    telegraphFrames: 3,
    telegraphFactor: 0.16,
    transitionFrames: 4,
    holdFrames: 3,
    recoveryFrames: 4,
    idleFrames: 4,
    fps: 16,
  },
};

const BOX_RIVAL_PHYSIQUES: Record<
  BoxRivalPhysique,
  {
    shoulderScale: number;
    armScale: number;
    hipScale: number;
    legScale: number;
    headScale: number;
    stanceScale: number;
  }
> = {
  featherweight: {
    shoulderScale: 0.9,
    armScale: 1.04,
    hipScale: 0.92,
    legScale: 1.02,
    headScale: 0.96,
    stanceScale: 0.94,
  },
  middleweight: {
    shoulderScale: 1,
    armScale: 1,
    hipScale: 1,
    legScale: 1,
    headScale: 1,
    stanceScale: 1,
  },
  heavyweight: {
    shoulderScale: 1.12,
    armScale: 0.96,
    hipScale: 1.08,
    legScale: 0.98,
    headScale: 1.04,
    stanceScale: 1.08,
  },
};

const BOX_RIVAL_PALETTES: Record<BoxRivalPalette, BoxRivalColors> = {
  arcade: {
    skeleton: "#ffe082",
    keypoints: "#ff6f61",
  },
  classic: {
    skeleton: "#f5f5f5",
    keypoints: "#c62828",
  },
  cyber: {
    skeleton: "#7df9ff",
    keypoints: "#ff4fd8",
  },
};

const PUNCH_ACTIVE_ARM: Record<
  BoxPunch,
  {
    shoulder: "left_shoulder" | "right_shoulder";
    elbow: "left_elbow" | "right_elbow";
    wrist: "left_wrist" | "right_wrist";
  }
> = {
  jab: {
    shoulder: "left_shoulder",
    elbow: "left_elbow",
    wrist: "left_wrist",
  },
  cross: {
    shoulder: "right_shoulder",
    elbow: "right_elbow",
    wrist: "right_wrist",
  },
  lead_hook: {
    shoulder: "left_shoulder",
    elbow: "left_elbow",
    wrist: "left_wrist",
  },
  rear_hook: {
    shoulder: "right_shoulder",
    elbow: "right_elbow",
    wrist: "right_wrist",
  },
};

const PUNCH_DEFENSE_HINT: Record<BoxPunch, BoxDefenseHint> = {
  jab: "block",
  cross: "block",
  lead_hook: "dodgeRight",
  rear_hook: "dodgeLeft",
};

const GUARD_POSE: PoseMap = {
  nose: { x: 320, y: 90 },
  left_eye: { x: 302, y: 80 },
  right_eye: { x: 338, y: 80 },
  left_ear: { x: 286, y: 92 },
  right_ear: { x: 354, y: 92 },
  left_shoulder: { x: 260, y: 150 },
  right_shoulder: { x: 380, y: 150 },
  left_elbow: { x: 295, y: 205 },
  right_elbow: { x: 345, y: 205 },
  left_wrist: { x: 305, y: 125 },
  right_wrist: { x: 335, y: 125 },
  left_hip: { x: 285, y: 270 },
  right_hip: { x: 355, y: 270 },
  left_knee: { x: 292, y: 385 },
  right_knee: { x: 348, y: 385 },
  left_ankle: { x: 296, y: 470 },
  right_ankle: { x: 344, y: 470 },
};

const PUNCH_TARGETS: Record<BoxPunch, PoseMap> = {
  jab: {
    ...GUARD_POSE,
    left_shoulder: { x: 270, y: 148 },
    left_elbow: { x: 330, y: 162 },
    left_wrist: { x: 420, y: 165 },
    right_shoulder: { x: 375, y: 154 },
    right_elbow: { x: 342, y: 210 },
    right_wrist: { x: 332, y: 130 },
    nose: { x: 328, y: 92 },
  },
  cross: {
    ...GUARD_POSE,
    right_shoulder: { x: 370, y: 148 },
    right_elbow: { x: 310, y: 162 },
    right_wrist: { x: 215, y: 165 },
    left_shoulder: { x: 265, y: 154 },
    left_elbow: { x: 298, y: 212 },
    left_wrist: { x: 308, y: 132 },
    nose: { x: 312, y: 92 },
  },
  lead_hook: {
    ...GUARD_POSE,
    left_shoulder: { x: 255, y: 150 },
    left_elbow: { x: 250, y: 132 },
    left_wrist: { x: 305, y: 110 },
    right_elbow: { x: 345, y: 214 },
    right_wrist: { x: 334, y: 132 },
    nose: { x: 327, y: 88 },
  },
  rear_hook: {
    ...GUARD_POSE,
    right_shoulder: { x: 385, y: 150 },
    right_elbow: { x: 390, y: 132 },
    right_wrist: { x: 336, y: 110 },
    left_elbow: { x: 295, y: 214 },
    left_wrist: { x: 306, y: 132 },
    nose: { x: 313, y: 88 },
  },
};

const createRng = (seed?: number) => {
  if (seed === undefined) {
    return () => Math.random();
  }

  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const lerp = (start: number, end: number, factor: number) =>
  start + (end - start) * factor;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const interpolatePoseMap = (
  from: PoseMap,
  to: PoseMap,
  factor: number,
): PoseMap =>
  KEYPOINT_ORDER.reduce((acc, keypoint) => {
    acc[keypoint] = {
      x: lerp(from[keypoint].x, to[keypoint].x, factor),
      y: lerp(from[keypoint].y, to[keypoint].y, factor),
    };
    return acc;
  }, {} as PoseMap);

const applyPhysiqueProfile = (
  pose: PoseMap,
  physique: BoxRivalPhysique,
): PoseMap => {
  const profile = BOX_RIVAL_PHYSIQUES[physique];
  const hipCenterX = (pose.left_hip.x + pose.right_hip.x) / 2;
  const hipCenterY = (pose.left_hip.y + pose.right_hip.y) / 2;

  return KEYPOINT_ORDER.reduce((acc, keypoint) => {
    const point = pose[keypoint];
    const dx = point.x - hipCenterX;
    const dy = point.y - hipCenterY;

    let scaleX = 1;
    let scaleY = 1;

    if (keypoint.includes("shoulder")) {
      scaleX = profile.shoulderScale;
      scaleY = profile.armScale;
    } else if (keypoint.includes("elbow") || keypoint.includes("wrist")) {
      scaleX = profile.armScale;
      scaleY = profile.armScale;
    } else if (keypoint.includes("hip")) {
      scaleX = profile.hipScale;
    } else if (keypoint.includes("knee") || keypoint.includes("ankle")) {
      scaleX = profile.stanceScale;
      scaleY = profile.legScale;
    } else {
      scaleX = profile.headScale;
      scaleY = profile.headScale;
    }

    acc[keypoint] = {
      x: hipCenterX + dx * scaleX,
      y: hipCenterY + dy * scaleY,
    };

    return acc;
  }, {} as PoseMap);
};

const createTelegraphPose = (
  guardPose: PoseMap,
  targetPose: PoseMap,
  punch: BoxPunch,
  telegraphFactor: number,
): PoseMap => {
  const telegraphPose = interpolatePoseMap(
    guardPose,
    targetPose,
    -telegraphFactor,
  );
  const activeArm = PUNCH_ACTIVE_ARM[punch];
  const direction =
    targetPose[activeArm.wrist].x > guardPose[activeArm.wrist].x ? 1 : -1;

  telegraphPose[activeArm.shoulder] = {
    x: telegraphPose[activeArm.shoulder].x - direction * 10,
    y: telegraphPose[activeArm.shoulder].y - 12,
  };
  telegraphPose[activeArm.elbow] = {
    x: telegraphPose[activeArm.elbow].x - direction * 22,
    y: telegraphPose[activeArm.elbow].y - 10,
  };
  telegraphPose[activeArm.wrist] = {
    x: telegraphPose[activeArm.wrist].x - direction * 16,
    y: telegraphPose[activeArm.wrist].y - 18,
  };
  telegraphPose.nose = {
    x: telegraphPose.nose.x - direction * 6,
    y: telegraphPose.nose.y - 4,
  };

  return KEYPOINT_ORDER.reduce((acc, keypoint) => {
    acc[keypoint] = {
      x: clamp(telegraphPose[keypoint].x, 120, 520),
      y: clamp(telegraphPose[keypoint].y, 40, 520),
    };
    return acc;
  }, {} as PoseMap);
};

const applyIdleBob = (pose: PoseMap, frameIndex: number): PoseMap => {
  const bobX = Math.sin(frameIndex * 0.35) * 3;
  const bobY = Math.cos(frameIndex * 0.4) * 4;

  return KEYPOINT_ORDER.reduce((acc, keypoint) => {
    const point = pose[keypoint];
    const verticalBias =
      keypoint.includes("ankle") || keypoint.includes("knee") ? bobY * 0.2 : bobY;

    acc[keypoint] = {
      x: point.x + bobX,
      y: point.y + verticalBias,
    };
    return acc;
  }, {} as PoseMap);
};

const poseMapToPose = (poseMap: PoseMap): Pose => ({
  keypoints: KEYPOINT_ORDER.map((name) => ({
    name,
    score: 1,
    x: poseMap[name].x,
    y: poseMap[name].y,
  })),
  score: 1,
});

const appendPoseFrame = (
  frames: Pose[],
  poseMap: PoseMap,
  frameIndex: number,
) => {
  frames.push(poseMapToPose(applyIdleBob(poseMap, frameIndex)));
};

const appendTimelineFrame = (
  timeline: BoxTimelineFrame[],
  frame: BoxTimelineFrame,
) => {
  timeline.push(frame);
};

const choosePunchSequence = (
  difficulty: BoxDifficulty,
  totalPunches: number,
  rng: () => number,
): BoxPunch[] => {
  const available = BOX_DIFFICULTY_CONFIG[difficulty].punches;
  const sequence: BoxPunch[] = [];

  while (sequence.length < totalPunches) {
    const nextPunch = available[Math.floor(rng() * available.length)];
    const lastPunch = sequence[sequence.length - 1];

    if (available.length > 1 && nextPunch === lastPunch) {
      continue;
    }

    sequence.push(nextPunch);
  }

  return sequence;
};

const resolvePunchSequence = (
  difficulty: BoxDifficulty,
  options: BoxGearOptions | undefined,
  rng: () => number,
) => {
  if (options?.punchSequence && options.punchSequence.length > 0) {
    return options.punchSequence;
  }

  const config = BOX_DIFFICULTY_CONFIG[difficulty];
  const framesPerPunch =
    config.telegraphFrames +
    config.transitionFrames +
    config.holdFrames +
    config.recoveryFrames +
    config.idleFrames;
  const requestedPunches = options?.totalPunches;
  const roundPunches = options?.roundDurationSeconds
    ? Math.floor(
        Math.max(1, options.roundDurationSeconds * config.fps - config.idleFrames) /
          Math.max(1, framesPerPunch),
      )
    : undefined;
  const totalPunches =
    requestedPunches ?? roundPunches ?? BOX_DIFFICULTY_CONFIG[difficulty].totalPunches;

  return choosePunchSequence(difficulty, Math.max(1, totalPunches), rng);
};

const padFramesToDuration = (
  frames: Pose[],
  fps: number,
  guardPose: PoseMap,
  roundDurationSeconds: number | undefined,
  frameCursor: number,
) => {
  if (!roundDurationSeconds) {
    return frames;
  }

  const targetFrames = Math.max(1, Math.round(roundDurationSeconds * fps));
  const paddedFrames = [...frames];

  while (paddedFrames.length < targetFrames) {
    appendPoseFrame(paddedFrames, guardPose, frameCursor++);
  }

  return paddedFrames.slice(0, targetFrames);
};

const buildPoseFrames = (
  difficulty: BoxDifficulty,
  options?: BoxGearOptions,
): { frames: Pose[]; punches: BoxPunch[]; fps: number; timeline: BoxTimelineFrame[] } => {
  const config = BOX_DIFFICULTY_CONFIG[difficulty];
  const rng = createRng(options?.seed);
  const punches = resolvePunchSequence(difficulty, options, rng);
  const rivalPhysique = options?.rivalPhysique ?? "middleweight";
  const guardPose = applyPhysiqueProfile(GUARD_POSE, rivalPhysique);
  const frames: Pose[] = [];
  const timeline: BoxTimelineFrame[] = [];
  let frameCursor = 0;

  for (let i = 0; i < config.idleFrames; i++) {
    appendPoseFrame(frames, guardPose, frameCursor++);
    appendTimelineFrame(timeline, {
      phase: "idle",
      punch: null,
      punchIndex: null,
      impact: false,
      defenseHint: null,
    });
  }

  punches.forEach((punch, punchIndex) => {
    const targetPose = applyPhysiqueProfile(PUNCH_TARGETS[punch], rivalPhysique);
    const telegraphPose = createTelegraphPose(
      guardPose,
      targetPose,
      punch,
      config.telegraphFactor,
    );
    const defenseHint = PUNCH_DEFENSE_HINT[punch];

    for (let i = 1; i <= config.telegraphFrames; i++) {
      appendPoseFrame(
        frames,
        interpolatePoseMap(guardPose, telegraphPose, i / config.telegraphFrames),
        frameCursor++,
      );
      appendTimelineFrame(timeline, {
        phase: "telegraph",
        punch,
        punchIndex,
        impact: false,
        defenseHint,
      });
    }

    for (let i = 1; i <= config.transitionFrames; i++) {
      appendPoseFrame(
        frames,
        interpolatePoseMap(
          telegraphPose,
          targetPose,
          i / config.transitionFrames,
        ),
        frameCursor++,
      );
      appendTimelineFrame(timeline, {
        phase: "attack",
        punch,
        punchIndex,
        impact: false,
        defenseHint,
      });
    }

    for (let i = 0; i < config.holdFrames; i++) {
      appendPoseFrame(frames, targetPose, frameCursor++);
      appendTimelineFrame(timeline, {
        phase: "attack",
        punch,
        punchIndex,
        impact: i === 0,
        defenseHint,
      });
    }

    for (let i = 1; i <= config.recoveryFrames; i++) {
      appendPoseFrame(
        frames,
        interpolatePoseMap(targetPose, guardPose, i / config.recoveryFrames),
        frameCursor++,
      );
      appendTimelineFrame(timeline, {
        phase: "recover",
        punch,
        punchIndex,
        impact: false,
        defenseHint,
      });
    }

    for (let i = 0; i < config.idleFrames; i++) {
      appendPoseFrame(frames, guardPose, frameCursor++);
      appendTimelineFrame(timeline, {
        phase: "idle",
        punch: null,
        punchIndex: null,
        impact: false,
        defenseHint: null,
      });
    }
  });

  let paddedFrames = frames;
  let paddedTimeline = timeline;

  if (options?.roundDurationSeconds) {
    paddedFrames = padFramesToDuration(
      frames,
      config.fps,
      guardPose,
      options.roundDurationSeconds,
      frameCursor,
    );

    while (paddedTimeline.length < paddedFrames.length) {
      paddedTimeline.push({
        phase: "idle",
        punch: null,
        punchIndex: null,
        impact: false,
        defenseHint: null,
      });
    }

    paddedTimeline = paddedTimeline.slice(0, paddedFrames.length);
  }

  return { frames: paddedFrames, punches, fps: config.fps, timeline: paddedTimeline };
};

const createRecordingPoints = (frames: Pose[], fps: number): RecordingPoint[] =>
  frames.map((pose, index) => ({
    timestamp: index / fps,
    poses: [pose],
  }));

const createRecordingAngles = (
  frames: Pose[],
  fps: number,
): RecordingAngle[] =>
  frames.map((pose, index) => ({
    timestamp: index / fps,
    angles: calculateAllBodyAngles(pose, 0.1),
  }));

export function createBoxRivalExercise(
  difficulty: BoxDifficulty = "intermedio",
  options?: BoxGearOptions,
): Exercise {
  const { frames, punches, fps } = buildPoseFrames(difficulty, options);
  const recording_points = createRecordingPoints(frames, fps);
  const recording_angles = createRecordingAngles(frames, fps);
  const generated = generateEventGraph(recording_angles);
  const now = new Date();

  return {
    exercise_id: `box-rival-${difficulty}`,
    name: `Box Rival ${difficulty}`,
    description: `AI rival pattern for boxing play mode (${difficulty}).`,
    difficulty,
    instructions: punches.map((punch, index) => `${index + 1}. ${punch}`),
    created_at: now.toISOString(),
    duration: frames.length / fps,
    recording_angles,
    recording_points,
    reps: punches.length,
    sets: 1,
    signals: generated.signals,
    event_graph: generated.eventGraph,
    time_constraints: generated.timeConstraints,
    completion: generated.completion,
    updatedAt: now.getTime(),
  };
}

export function createBoxRivalPattern(
  difficulty: BoxDifficulty = "intermedio",
  options?: BoxGearOptions,
): BoxRivalPattern {
  const { punches, fps, timeline } = buildPoseFrames(difficulty, options);

  return {
    exercise: createBoxRivalExercise(difficulty, options),
    timeline,
    punches,
    fps,
  };
}

export function getBoxRivalColors(
  palette: BoxRivalPalette = "arcade",
): BoxRivalColors {
  return BOX_RIVAL_PALETTES[palette];
}
