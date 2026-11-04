import type { EvaluationType } from "../config/appConfig";
import type { Pose } from "../pose/types";
import type {
  EventNode,
  Exercise,
  GridValidationDefinition,
  SignalDef,
  TimeConstraint,
} from "../exercise/types";
import { calculateAngle, findKeypoint } from "../pose/geometry";

const MIN_CONFIDENCE = 0.2;
const TREND_EPSILON = 0.25;
const SMOOTHING_WINDOW = 4;
const RANGE_MARGIN_PCT = 0.08;
const ANGLE_MARGIN_MIN = 8;
const DISTANCE_MARGIN_MIN = 14;
const RELATIVE_POSITION_MARGIN_MIN = 10;
const HYSTERESIS_MULTIPLIER = 1.35;
const HOLD_MISS_GRACE_MS = 220;
const HOLD_DECAY_RATE = 0.35;
const DEFAULT_NODE_HOLD_MS = 180;
const GRID_PROGRESS_SMOOTHING = 0.2;
/** Max time a single frame may contribute to hold/quality (guards against stalls). */
const MAX_FRAME_DELTA_MS = 250;
/** Live grid window = ceil(target length * factor) + extra, to bound flailing/memory. */
const GRID_LIVE_WINDOW_FACTOR = 1.5;
const GRID_LIVE_WINDOW_EXTRA = 2;
/** Soft time constraints decay linearly to 0 over max(min, ref * pct) outside the window. */
const TEMPO_TOLERANCE_MIN_MS = 300;
const TEMPO_TOLERANCE_PCT = 0.5;
const TEMPO_HARD_WEIGHT = 2;
const TEMPO_SOFT_WEIGHT = 1;
/** Weights of FSM progress vs grid progress when both are available. */
const OVERALL_FSM_WEIGHT = 0.6;
const OVERALL_GRID_WEIGHT = 0.4;
/**
 * Accuracy (quality + tempo) only scales the score between these bounds, so a
 * fully completed rep never drops below the 80% rep threshold because of
 * accuracy alone; accuracy differentiates reps above it.
 */
const OVERALL_ACCURACY_FLOOR = 0.8;

export interface SessionComparatorSnapshot {
  score: number;
  matchedCount: number;
  totalNodes: number;
  currentNodeId: string | null;
  completion: number;
  completed: boolean;
  activeSignals: Record<string, number>;
  gridScore: number;
  gridProgress: number;
  gridMatchedKeypoints: number;
  gridTotalKeypoints: number;
  /** 0–1: fraction of hold accumulated for the current active node */
  holdProgress: number;
  /** 0–100: continuous score including partial-hold credit */
  progressScore: number;
  /** 0–100: average signal-centering quality across matched nodes (0 = no data) */
  qualityScore: number;
  /** 0–100: weighted compliance with `time_constraints` (0 when none resolved yet) */
  tempoScore: number;
  /** Time constraints already evaluated / total applicable to this exercise */
  tempoResolved: number;
  tempoTotal: number;
  /** 0–100: mean of available accuracy signals (quality, tempo); 0 = no data */
  accuracyScore: number;
  /**
   * 0–100: unified score = shape (FSM progress and/or grid progress) scaled by
   * accuracy. Used by `evaluation.type = "hybrid"`.
   */
  overallScore: number;
}

export interface SessionComparator {
  update: (pose: Pose, nowMs: number) => SessionComparatorSnapshot;
  reset: () => SessionComparatorSnapshot;
  getSnapshot: () => SessionComparatorSnapshot;
}

const buildLevelMap = (
  nodes: EventNode[],
  edges: { from: string; to: string }[],
) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentsById = new Map<string, string[]>();

  for (const node of nodes) {
    parentsById.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.to) || !nodeById.has(edge.from)) continue;
    parentsById.get(edge.to)?.push(edge.from);
  }

  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const getLevel = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;

    visiting.add(id);
    const parents = parentsById.get(id) ?? [];
    const level =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((parentId) => getLevel(parentId))) + 1;
    visiting.delete(id);

    memo.set(id, level);
    return level;
  };

  for (const node of nodes) {
    getLevel(node.id);
  }

  return { levelById: memo, parentsById };
};

const getSignalBaseMargin = (signalDef?: SignalDef): number => {
  if (!signalDef) return ANGLE_MARGIN_MIN;
  if (signalDef.type === "distance") return DISTANCE_MARGIN_MIN;
  if (signalDef.type === "relative_position")
    return RELATIVE_POSITION_MARGIN_MIN;
  return ANGLE_MARGIN_MIN;
};

const computeRangeMargin = (range: [number, number], signalDef?: SignalDef) => {
  const [min, max] = range;
  const span = Math.max(1, Math.abs(max - min));
  const base = getSignalBaseMargin(signalDef);
  return Math.max(base, span * RANGE_MARGIN_PCT);
};

const inAdaptiveRange = (
  value: number,
  range: [number, number] | undefined,
  signalDef: SignalDef | undefined,
  wasInRange: boolean,
) => {
  if (!range) return true;
  const [min, max] = range;
  const margin = computeRangeMargin(range, signalDef);
  const effectiveMargin = wasInRange ? margin * HYSTERESIS_MULTIPLIER : margin;
  return value >= min - effectiveMargin && value <= max + effectiveMargin;
};

const smoothSignalValue = (
  signalName: string,
  rawValue: number,
  historyBySignal: Map<string, number[]>,
) => {
  const history = historyBySignal.get(signalName) ?? [];
  history.push(rawValue);
  while (history.length > SMOOTHING_WINDOW) {
    history.shift();
  }
  historyBySignal.set(signalName, history);

  const sum = history.reduce((acc, value) => acc + value, 0);
  return sum / Math.max(1, history.length);
};

const getSignalValue = (pose: Pose, signalDef: SignalDef): number | null => {
  const keypoints = pose.keypoints ?? [];

  const getPoint = (name: string) => {
    const kp = findKeypoint(keypoints, name);
    if (!kp) return null;
    const score = typeof kp.score === "number" ? kp.score : 1;
    if (
      !Number.isFinite(kp.x) ||
      !Number.isFinite(kp.y) ||
      score < MIN_CONFIDENCE
    ) {
      return null;
    }
    return kp;
  };

  if (signalDef.type === "angle") {
    if (signalDef.points.length !== 3) return null;
    const p1 = getPoint(signalDef.points[0]);
    const p2 = getPoint(signalDef.points[1]);
    const p3 = getPoint(signalDef.points[2]);
    if (!p1 || !p2 || !p3) return null;
    return calculateAngle(p1, p2, p3);
  }

  if (signalDef.type === "distance") {
    if (signalDef.points.length !== 2) return null;
    const p1 = getPoint(signalDef.points[0]);
    const p2 = getPoint(signalDef.points[1]);
    if (!p1 || !p2) return null;

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  if (signalDef.type === "relative_position") {
    if (signalDef.points.length !== 2) return null;
    const p1 = getPoint(signalDef.points[0]);
    const p2 = getPoint(signalDef.points[1]);
    if (!p1 || !p2) return null;

    return p1.y - p2.y;
  }

  return null;
};

const buildSignalsFromPose = (
  pose: Pose,
  exercise: Exercise,
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!exercise.signals) return out;

  for (const [signalName, signalDef] of Object.entries(exercise.signals)) {
    const value = getSignalValue(pose, signalDef);
    if (value == null || !Number.isFinite(value)) continue;
    out[signalName] = value;
  }

  return out;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toGridCell = (
  xNorm: number,
  yNorm: number,
  cols: number,
  rows: number,
): number => {
  const col = clamp(Math.floor(xNorm * cols), 0, cols - 1);
  const row = clamp(Math.floor(yNorm * rows), 0, rows - 1);
  return row * cols + col;
};

const getPoseBounds = (pose: Pose, minConfidence: number) => {
  const valid = (pose.keypoints ?? []).filter(
    (kp) =>
      Number.isFinite(kp.x) &&
      Number.isFinite(kp.y) &&
      (typeof kp.score !== "number" || kp.score >= minConfidence),
  );

  if (valid.length < 3) return null;

  const xs = valid.map((kp) => kp.x);
  const ys = valid.map((kp) => kp.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 1 || height < 1) return null;

  return { minX, minY, width, height };
};

const appendCompressedCell = (
  sequenceByKeypoint: Map<string, number[]>,
  keypointName: string,
  cell: number,
  maxLength: number,
) => {
  const sequence = sequenceByKeypoint.get(keypointName) ?? [];
  const last = sequence.length > 0 ? sequence[sequence.length - 1] : null;
  if (last !== cell) {
    sequence.push(cell);
    while (sequence.length > maxLength) sequence.shift();
    sequenceByKeypoint.set(keypointName, sequence);
  }
};

/**
 * Longest common subsequence length. Tolerates extra/missing cells caused by
 * boundary jitter, unlike a strict common prefix where one bad cell caps
 * progress forever.
 */
const getLcsLength = (target: number[], live: number[]) => {
  if (target.length === 0 || live.length === 0) return 0;
  let prev = new Array<number>(live.length + 1).fill(0);
  let curr = new Array<number>(live.length + 1).fill(0);
  for (let i = 1; i <= target.length; i += 1) {
    for (let j = 1; j <= live.length; j += 1) {
      curr[j] =
        target[i - 1] === live[j - 1]
          ? prev[j - 1] + 1
          : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[live.length];
};

const getGridLiveWindow = (targetLength: number) =>
  Math.ceil(targetLength * GRID_LIVE_WINDOW_FACTOR) + GRID_LIVE_WINDOW_EXTRA;

const computeGridProgress = (
  gridValidation: GridValidationDefinition | undefined,
  liveSequenceByKeypoint: Map<string, number[]>,
) => {
  if (!gridValidation) {
    return {
      score: 0,
      progress: 0,
      matchedKeypoints: 0,
      totalKeypoints: 0,
    };
  }

  const keypoints = gridValidation.keypoints ?? [];
  if (keypoints.length === 0) {
    return {
      score: 0,
      progress: 0,
      matchedKeypoints: 0,
      totalKeypoints: 0,
    };
  }

  let progressSum = 0;
  let matchedKeypoints = 0;

  for (const keypointName of keypoints) {
    const target =
      gridValidation.cell_sequence_by_keypoint?.[keypointName] ?? [];
    const live = liveSequenceByKeypoint.get(keypointName) ?? [];

    if (target.length === 0) {
      matchedKeypoints += 1;
      progressSum += 1;
      continue;
    }

    const lcs = getLcsLength(target, live);
    const ratio = clamp(lcs / target.length, 0, 1);
    if (ratio >= 1) matchedKeypoints += 1;
    progressSum += ratio;
  }

  const progress = keypoints.length > 0 ? progressSum / keypoints.length : 0;
  return {
    score: Math.round(progress * 100),
    progress,
    matchedKeypoints,
    totalKeypoints: keypoints.length,
  };
};

const computeTempoCompliance = (
  elapsedMs: number,
  constraint: TimeConstraint,
): number => {
  const min = Math.max(0, constraint.min_ms ?? 0);
  const rawMax = constraint.max_ms;
  // Generator can emit non-positive max_ms for overlapping nodes: no upper bound then.
  const max =
    rawMax != null && rawMax > 0 && rawMax >= min
      ? rawMax
      : Number.POSITIVE_INFINITY;

  if (elapsedMs >= min && elapsedMs <= max) return 1;
  if (constraint.severity === "hard") return 0;

  const distance = elapsedMs < min ? min - elapsedMs : elapsedMs - max;
  const reference = Number.isFinite(max) ? max : min;
  const tolerance = Math.max(
    TEMPO_TOLERANCE_MIN_MS,
    reference * TEMPO_TOLERANCE_PCT,
  );
  return clamp(1 - distance / tolerance, 0, 1);
};

const computeNodeQuality = (
  node: EventNode,
  signalValue: number | null,
  signalDef: SignalDef | undefined,
): number => {
  if (
    node.type === "sync" ||
    !node.range ||
    signalValue == null ||
    !Number.isFinite(signalValue)
  ) {
    return 1;
  }
  const [min, max] = node.range;
  const center = (min + max) / 2;
  const margin = computeRangeMargin(node.range, signalDef);
  const halfWidth = (max - min) / 2 + margin;
  if (halfWidth <= 0) return 1;
  return Math.max(0, 1 - Math.abs(signalValue - center) / halfWidth);
};

export function createSessionComparator(exercise: Exercise): SessionComparator {
  const gridValidation = exercise.grid_validation;
  const nodes = exercise.event_graph?.nodes ?? [];
  const edges = exercise.event_graph?.edges ?? [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const timeConstraints = (exercise.time_constraints ?? []).filter(
    (c) => nodeIds.has(c.from) && nodeIds.has(c.to),
  );
  const terminalNodes = new Set(exercise.completion?.terminal_nodes ?? []);
  const { levelById, parentsById } = buildLevelMap(nodes, edges);

  const orderedNodes = [...nodes].sort((a, b) => {
    const lA = levelById.get(a.id) ?? 0;
    const lB = levelById.get(b.id) ?? 0;
    if (lA !== lB) return lA - lB;
    return a.id.localeCompare(b.id);
  });

  let score = 0;
  let matched = new Set<string>();
  const holdAccumulatedMsByNode = new Map<string, number>();
  const lastEvalAtByNode = new Map<string, number>();
  const lastMatchedAtByNode = new Map<string, number>();
  const inRangeStateByNode = new Map<string, boolean>();
  const matchedAtByNode = new Map<string, number>();
  const resolvedConstraints = new Set<string>();
  let tempoWeightSum = 0;
  let tempoComplianceSum = 0;
  const qualityMsByNode = new Map<string, number>();
  const qualityWeightedSumByNode = new Map<string, number>();
  const lastSignalValues = new Map<string, number>();
  const smoothedSignalHistoryByName = new Map<string, number[]>();
  const liveGridSequenceByKeypoint = new Map<string, number[]>();
  let smoothedGridProgress: number | null = null;
  let holdProgress = 0;
  let progressScore = 0;
  let qualityScore = 0;
  let nodeQualitySum = 0;
  let nodeQualityCount = 0;
  let snapshot: SessionComparatorSnapshot = {
    score: 0,
    matchedCount: 0,
    totalNodes: nodes.length,
    currentNodeId: orderedNodes[0]?.id ?? null,
    completion: 0,
    completed: false,
    activeSignals: {},
    gridScore: 0,
    gridProgress: 0,
    gridMatchedKeypoints: 0,
    gridTotalKeypoints: gridValidation?.keypoints.length ?? 0,
    holdProgress: 0,
    progressScore: 0,
    qualityScore: 0,
    tempoScore: 0,
    tempoResolved: 0,
    tempoTotal: timeConstraints.length,
    accuracyScore: 0,
    overallScore: 0,
  };

  const getCurrentNode = () => {
    for (const node of orderedNodes) {
      if (matched.has(node.id)) continue;
      const parents = parentsById.get(node.id) ?? [];
      const parentsMet = parents.every((id) => matched.has(id));
      if (parentsMet) return node.id;
    }
    return null;
  };

  const updateSnapshot = (
    activeSignals: Record<string, number>,
    gridMetrics?: {
      score: number;
      progress: number;
      matchedKeypoints: number;
      totalKeypoints: number;
    },
  ) => {
    const completed =
      terminalNodes.size > 0
        ? [...terminalNodes].every((id) => matched.has(id))
        : matched.size >= nodes.length && nodes.length > 0;

    const gridScoreNow = gridMetrics?.score ?? snapshot.gridScore;
    const gridTotalNow =
      gridMetrics?.totalKeypoints ?? snapshot.gridTotalKeypoints;

    const tempoScore =
      tempoWeightSum > 0
        ? Math.round((tempoComplianceSum / tempoWeightSum) * 100)
        : 0;

    const accuracyParts: number[] = [];
    if (nodeQualityCount > 0) accuracyParts.push(qualityScore / 100);
    if (tempoWeightSum > 0) accuracyParts.push(tempoScore / 100);
    const accuracy =
      accuracyParts.length > 0
        ? accuracyParts.reduce((a, b) => a + b, 0) / accuracyParts.length
        : null;

    const hasGrid = gridTotalNow > 0;
    const hasFsm = nodes.length > 0;
    const shape =
      hasFsm && hasGrid
        ? progressScore * OVERALL_FSM_WEIGHT +
          gridScoreNow * OVERALL_GRID_WEIGHT
        : hasGrid
          ? gridScoreNow
          : progressScore;
    const multiplier =
      accuracy == null
        ? 1
        : OVERALL_ACCURACY_FLOOR + (1 - OVERALL_ACCURACY_FLOOR) * accuracy;

    snapshot = {
      score,
      matchedCount: matched.size,
      totalNodes: nodes.length,
      currentNodeId: getCurrentNode(),
      completion: nodes.length > 0 ? matched.size / nodes.length : 0,
      completed,
      activeSignals,
      gridScore: gridMetrics?.score ?? snapshot.gridScore,
      gridProgress: gridMetrics?.progress ?? snapshot.gridProgress,
      gridMatchedKeypoints:
        gridMetrics?.matchedKeypoints ?? snapshot.gridMatchedKeypoints,
      gridTotalKeypoints:
        gridMetrics?.totalKeypoints ?? snapshot.gridTotalKeypoints,
      holdProgress,
      progressScore,
      qualityScore,
      tempoScore,
      tempoResolved: resolvedConstraints.size,
      tempoTotal: timeConstraints.length,
      accuracyScore: accuracy == null ? 0 : Math.round(accuracy * 100),
      overallScore: Math.round(clamp(shape * multiplier, 0, 100)),
    };

    return snapshot;
  };

  const nodeConditionMatches = (
    node: EventNode,
    activeSignals: Record<string, number>,
  ) => {
    if (node.type === "sync") {
      const requires = node.requires ?? [];
      return requires.every((requiredId) => matched.has(requiredId));
    }

    if (!node.signal) return true;

    const signalValue = activeSignals[node.signal];
    if (!Number.isFinite(signalValue)) return false;

    const signalDef = exercise.signals?.[node.signal];
    const wasInRange = inRangeStateByNode.get(node.id) ?? false;
    const isInRangeNow = inAdaptiveRange(
      signalValue,
      node.range,
      signalDef,
      wasInRange,
    );
    inRangeStateByNode.set(node.id, isInRangeNow);

    if (!isInRangeNow) return false;

    if (node.type === "uphill") {
      const prev = lastSignalValues.get(node.signal);
      if (prev != null && signalValue < prev + TREND_EPSILON) return false;
    }

    if (node.type === "downhill") {
      const prev = lastSignalValues.get(node.signal);
      if (prev != null && signalValue > prev - TREND_EPSILON) return false;
    }

    return true;
  };

  return {
    update: (pose: Pose, nowMs: number) => {
      const rawSignals = buildSignalsFromPose(pose, exercise);
      const activeSignals: Record<string, number> = {};

      for (const [signalName, rawValue] of Object.entries(rawSignals)) {
        activeSignals[signalName] = smoothSignalValue(
          signalName,
          rawValue,
          smoothedSignalHistoryByName,
        );
      }

      let gridMetrics = {
        score: snapshot.gridScore,
        progress: snapshot.gridProgress,
        matchedKeypoints: snapshot.gridMatchedKeypoints,
        totalKeypoints: snapshot.gridTotalKeypoints,
      };

      if (gridValidation) {
        const bounds = getPoseBounds(
          pose,
          gridValidation.min_confidence ?? MIN_CONFIDENCE,
        );
        if (bounds) {
          const keypoints = pose.keypoints ?? [];
          for (const keypointName of gridValidation.keypoints) {
            const kp = findKeypoint(keypoints, keypointName);
            const score = kp?.score ?? 1;
            if (
              !kp ||
              !Number.isFinite(kp.x) ||
              !Number.isFinite(kp.y) ||
              score < (gridValidation.min_confidence ?? MIN_CONFIDENCE)
            ) {
              continue;
            }

            const xNorm = clamp(
              (kp.x - bounds.minX) / bounds.width,
              0,
              0.999999,
            );
            const yNorm = clamp(
              (kp.y - bounds.minY) / bounds.height,
              0,
              0.999999,
            );
            const cell = toGridCell(
              xNorm,
              yNorm,
              gridValidation.cols,
              gridValidation.rows,
            );
            appendCompressedCell(
              liveGridSequenceByKeypoint,
              keypointName,
              cell,
              getGridLiveWindow(
                gridValidation.cell_sequence_by_keypoint?.[keypointName]
                  ?.length ?? 0,
              ),
            );
          }
        }

        const computedGrid = computeGridProgress(
          gridValidation,
          liveGridSequenceByKeypoint,
        );
        smoothedGridProgress =
          smoothedGridProgress === null
            ? computedGrid.progress
            : smoothedGridProgress * (1 - GRID_PROGRESS_SMOOTHING) +
              computedGrid.progress * GRID_PROGRESS_SMOOTHING;
        gridMetrics = {
          score: Math.round(smoothedGridProgress * 100),
          progress: smoothedGridProgress,
          matchedKeypoints: computedGrid.matchedKeypoints,
          totalKeypoints: computedGrid.totalKeypoints,
        };
      }

      for (const node of orderedNodes) {
        if (matched.has(node.id)) continue;

        const parents = parentsById.get(node.id) ?? [];
        const parentsMet = parents.every((id) => matched.has(id));

        if (!parentsMet) {
          inRangeStateByNode.set(node.id, false);
          continue;
        }

        const matches = nodeConditionMatches(node, activeSignals);
        const lastEvalAt = lastEvalAtByNode.get(node.id) ?? nowMs;
        const deltaMs = clamp(nowMs - lastEvalAt, 0, MAX_FRAME_DELTA_MS);
        lastEvalAtByNode.set(node.id, nowMs);

        const holdMs = Math.max(
          0,
          node.hold_ms && node.hold_ms > 0
            ? node.hold_ms
            : DEFAULT_NODE_HOLD_MS,
        );
        const currentAccum = holdAccumulatedMsByNode.get(node.id) ?? 0;

        if (!matches) {
          const lastMatchAt = lastMatchedAtByNode.get(node.id) ?? 0;
          const withinGrace = nowMs - lastMatchAt <= HOLD_MISS_GRACE_MS;

          if (!withinGrace) {
            const decayed = Math.max(
              0,
              currentAccum - deltaMs * HOLD_DECAY_RATE,
            );
            holdAccumulatedMsByNode.set(node.id, decayed);
          }
          continue;
        }

        const nextAccum = Math.min(holdMs, currentAccum + deltaMs);
        holdAccumulatedMsByNode.set(node.id, nextAccum);

        // Accumulate centering quality over the whole hold, not a single frame
        if (node.type !== "sync" && node.range && node.signal != null) {
          const sample = computeNodeQuality(
            node,
            activeSignals[node.signal] ?? null,
            exercise.signals?.[node.signal],
          );
          const weight = Math.max(1, deltaMs);
          qualityMsByNode.set(
            node.id,
            (qualityMsByNode.get(node.id) ?? 0) + weight,
          );
          qualityWeightedSumByNode.set(
            node.id,
            (qualityWeightedSumByNode.get(node.id) ?? 0) + sample * weight,
          );
        }
        lastMatchedAtByNode.set(node.id, nowMs);

        if (nextAccum >= holdMs) {
          matched.add(node.id);
          matchedAtByNode.set(node.id, nowMs);

          // Resolve tempo constraints that end at this node. Elapsed time is
          // measured from the source node's match to the start of this
          // node's hold (matched time minus its hold window).
          for (const constraint of timeConstraints) {
            if (constraint.to !== node.id) continue;
            if (resolvedConstraints.has(constraint.id)) continue;
            const fromAt = matchedAtByNode.get(constraint.from);
            if (fromAt == null) continue;
            const elapsed = Math.max(0, nowMs - holdMs - fromAt);
            const weight =
              constraint.severity === "hard"
                ? TEMPO_HARD_WEIGHT
                : TEMPO_SOFT_WEIGHT;
            tempoWeightSum += weight;
            tempoComplianceSum +=
              weight * computeTempoCompliance(elapsed, constraint);
            resolvedConstraints.add(constraint.id);
          }

          holdAccumulatedMsByNode.delete(node.id);
          inRangeStateByNode.delete(node.id);
          score += 1;

          // Only nodes with a range contribute (sync/no-range nodes would
          // otherwise inflate quality with a free 100%)
          const weightMs = qualityMsByNode.get(node.id) ?? 0;
          if (weightMs > 0) {
            nodeQualitySum +=
              (qualityWeightedSumByNode.get(node.id) ?? 0) / weightMs;
            nodeQualityCount += 1;
          }
          qualityMsByNode.delete(node.id);
          qualityWeightedSumByNode.delete(node.id);
        }
      }

      for (const [signalName, signalValue] of Object.entries(activeSignals)) {
        lastSignalValues.set(signalName, signalValue);
      }

      // Compute hold progress for the current active node
      const activeNodeId = getCurrentNode();
      holdProgress = 0;
      if (activeNodeId) {
        const activeNode = orderedNodes.find((n) => n.id === activeNodeId);
        if (activeNode) {
          const hMs = Math.max(
            0,
            activeNode.hold_ms && activeNode.hold_ms > 0
              ? activeNode.hold_ms
              : DEFAULT_NODE_HOLD_MS,
          );
          const accumulated = holdAccumulatedMsByNode.get(activeNodeId) ?? 0;
          holdProgress = hMs > 0 ? Math.min(1, accumulated / hMs) : 0;
        }
      }

      // progressScore: 0-100 continuous, with partial-hold credit (capped at 0.9 to avoid
      // reaching the node's full share before it officially matches)
      progressScore =
        nodes.length > 0
          ? Math.min(
              100,
              ((matched.size + holdProgress * 0.9) / nodes.length) * 100,
            )
          : 0;

      // qualityScore: average centering quality across all matched nodes
      qualityScore =
        nodeQualityCount > 0
          ? Math.round((nodeQualitySum / nodeQualityCount) * 100)
          : 0;

      return updateSnapshot(activeSignals, gridMetrics);
    },
    reset: () => {
      score = 0;
      matched = new Set<string>();
      holdAccumulatedMsByNode.clear();
      lastEvalAtByNode.clear();
      lastMatchedAtByNode.clear();
      inRangeStateByNode.clear();
      matchedAtByNode.clear();
      resolvedConstraints.clear();
      tempoWeightSum = 0;
      tempoComplianceSum = 0;
      qualityMsByNode.clear();
      qualityWeightedSumByNode.clear();
      lastSignalValues.clear();
      smoothedSignalHistoryByName.clear();
      liveGridSequenceByKeypoint.clear();
      smoothedGridProgress = null;
      holdProgress = 0;
      progressScore = 0;
      qualityScore = 0;
      nodeQualitySum = 0;
      nodeQualityCount = 0;
      return updateSnapshot(
        {},
        {
          score: 0,
          progress: 0,
          matchedKeypoints: 0,
          totalKeypoints: gridValidation?.keypoints.length ?? 0,
        },
      );
    },
    getSnapshot: () => snapshot,
  };
}

/**
 * Picks the 0–100 score a client should compare against the rep threshold,
 * according to `evaluation.type`.
 */
export const selectScorePercent = (
  snapshot: SessionComparatorSnapshot,
  evaluationType: EvaluationType,
): number => {
  if (evaluationType === "hybrid") return snapshot.overallScore;
  if (evaluationType === "grid") {
    if (Number.isFinite(snapshot.gridScore)) return snapshot.gridScore;
    return Math.round((snapshot.gridProgress ?? 0) * 100);
  }
  return snapshot.progressScore;
};
