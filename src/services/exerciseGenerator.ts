import type {
  SignalDef,
  EventNode,
  EventEdge,
  EventGraph,
  TimeConstraint,
  CompletionCriteria,
  RecordingAngle,
  BodyPart,
} from "../types/exercise";

// ==================== Constants ====================

/** Noise tolerance for angle variations (in degrees) */
export const ANGLE_NOISE_TOLERANCE = 5;

/** Minimum angle change to consider as movement (in degrees) */
export const MIN_MOVEMENT_THRESHOLD = 8;

/** Time tolerance for sync nodes (in milliseconds) */
export const SYNC_TIME_TOLERANCE_MS = 100;

/** Minimum hold time for a node (in milliseconds) */
export const MIN_HOLD_MS = 50;

// ==================== Types ====================

interface AngleTimeSeries {
  name: string;
  points: [string, string, string];
  values: { timestamp: number; value: number }[];
}

interface LocalExtremum {
  type: "min" | "max";
  index: number;
  timestamp: number;
  value: number;
}

interface NodeWithTiming {
  node: EventNode;
  startTimestamp: number;
  endTimestamp: number;
  durationMs: number;
}

// ==================== Helper Functions ====================

/**
 * Extracts time series data for each angle from recording_angles
 */
function extractAngleTimeSeries(
  recordingAngles: RecordingAngle[],
): Map<string, AngleTimeSeries> {
  const angleMap = new Map<string, AngleTimeSeries>();

  console.log("[extractAngleTimeSeries] Processing", recordingAngles.length, "frames");
  
  if (recordingAngles.length > 0) {
    console.log("[extractAngleTimeSeries] First frame sample:", JSON.stringify(recordingAngles[0]).substring(0, 200));
  }

  for (const frame of recordingAngles) {
    if (!frame.angles || !Array.isArray(frame.angles)) {
      console.warn("[extractAngleTimeSeries] Frame missing angles array:", frame);
      continue;
    }
    
    for (const angle of frame.angles) {
      if (!angle.name || angle.value === undefined) {
        console.warn("[extractAngleTimeSeries] Invalid angle entry:", angle);
        continue;
      }
      
      if (!angleMap.has(angle.name)) {
        angleMap.set(angle.name, {
          name: angle.name,
          points: angle.points,
          values: [],
        });
      }
      angleMap.get(angle.name)!.values.push({
        timestamp: frame.timestamp,
        value: angle.value,
      });
    }
  }

  console.log("[extractAngleTimeSeries] Extracted", angleMap.size, "unique angles");
  
  return angleMap;
}

/**
 * Detects if an angle has significant movement
 */
function hasSignificantMovement(
  series: AngleTimeSeries,
  threshold: number = MIN_MOVEMENT_THRESHOLD,
): boolean {
  if (series.values.length < 2) return false;

  const values = series.values.map((v) => v.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return max - min >= threshold;
}

/**
 * Find local minima and maxima in angle time series with noise tolerance
 */
function findLocalExtrema(
  series: AngleTimeSeries,
  noiseTolerance: number = ANGLE_NOISE_TOLERANCE,
): LocalExtremum[] {
  const extrema: LocalExtremum[] = [];
  const values = series.values;

  if (values.length < 3) return extrema;

  // Smooth the data using a simple moving average to reduce noise
  const smoothedValues = smoothData(
    values.map((v) => v.value),
    3,
  );

  let lastExtremum: LocalExtremum | null = null;

  for (let i = 1; i < smoothedValues.length - 1; i++) {
    const prev = smoothedValues[i - 1];
    const curr = smoothedValues[i];
    const next = smoothedValues[i + 1];

    // Check for local minimum
    if (curr < prev && curr < next) {
      const extremum: LocalExtremum = {
        type: "min",
        index: i,
        timestamp: values[i].timestamp,
        value: values[i].value,
      };

      // Check if this extremum is significantly different from the last one
      if (
        !lastExtremum ||
        Math.abs(extremum.value - lastExtremum.value) > noiseTolerance
      ) {
        extrema.push(extremum);
        lastExtremum = extremum;
      }
    }

    // Check for local maximum
    if (curr > prev && curr > next) {
      const extremum: LocalExtremum = {
        type: "max",
        index: i,
        timestamp: values[i].timestamp,
        value: values[i].value,
      };

      // Check if this extremum is significantly different from the last one
      if (
        !lastExtremum ||
        Math.abs(extremum.value - lastExtremum.value) > noiseTolerance
      ) {
        extrema.push(extremum);
        lastExtremum = extremum;
      }
    }
  }

  return extrema;
}

/**
 * Simple moving average smoothing
 */
function smoothData(data: number[], windowSize: number): number[] {
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - halfWindow);
      j <= Math.min(data.length - 1, i + halfWindow);
      j++
    ) {
      sum += data[j];
      count++;
    }
    result.push(sum / count);
  }

  return result;
}

/**
 * Generate a node ID from angle name and range
 */
function generateNodeId(
  angleName: string,
  rangeMin: number,
  rangeMax: number,
): string {
  return `${angleName}_${Math.round(rangeMin)}_${Math.round(rangeMax)}`;
}

// ==================== Main Functions ====================

/**
 * Creates signal definitions from angles that have significant movement
 */
export function createSignals(
  recordingAngles: RecordingAngle[],
): Record<string, SignalDef> {
  const signals: Record<string, SignalDef> = {};
  const angleMap = extractAngleTimeSeries(recordingAngles);

  console.log("[createSignals] Found angle series:", Array.from(angleMap.keys()));

  for (const [name, series] of angleMap) {
    const values = series.values.map((v) => v.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    console.log(`[createSignals] ${name}: min=${min.toFixed(1)}, max=${max.toFixed(1)}, range=${range.toFixed(1)}, threshold=${MIN_MOVEMENT_THRESHOLD}`);
    
    if (hasSignificantMovement(series)) {
      // Convert string points to BodyPart type
      signals[name] = {
        type: "angle",
        points: series.points as BodyPart[],
      };
      console.log(`[createSignals] ${name} INCLUDED (range >= threshold)`);
    }
  }

  return signals;
}

/**
 * Creates event nodes based on angle values, splitting at local minima/maxima
 * Returns nodes with timing information for sync node creation
 */
export function createNodes(
  recordingAngles: RecordingAngle[],
  signals: Record<string, SignalDef>,
): NodeWithTiming[] {
  const nodesWithTiming: NodeWithTiming[] = [];
  const angleMap = extractAngleTimeSeries(recordingAngles);

  for (const signalName of Object.keys(signals)) {
    const series = angleMap.get(signalName);
    if (!series || series.values.length < 2) continue;

    const extrema = findLocalExtrema(series);

    // If no extrema found, create a single node for the entire range
    if (extrema.length === 0) {
      const values = series.values.map((v) => v.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const startTime = series.values[0].timestamp;
      const endTime = series.values[series.values.length - 1].timestamp;
      const durationMs = (endTime - startTime) * 1000;

      nodesWithTiming.push({
        node: {
          id: generateNodeId(signalName, min, max),
          signal: signalName,
          range: [Math.round(min - ANGLE_NOISE_TOLERANCE), Math.round(max + ANGLE_NOISE_TOLERANCE)],
          hold_ms: Math.max(MIN_HOLD_MS, Math.round(durationMs)),
          emit: true,
        },
        startTimestamp: startTime,
        endTimestamp: endTime,
        durationMs,
      });
      continue;
    }

    // Create nodes between extrema
    // Add start point as first extremum if not present
    const allPoints = [
      {
        type: series.values[0].value < (extrema[0]?.value ?? 0) ? "min" : "max",
        index: 0,
        timestamp: series.values[0].timestamp,
        value: series.values[0].value,
      } as LocalExtremum,
      ...extrema,
      {
        type:
          series.values[series.values.length - 1].value <
          (extrema[extrema.length - 1]?.value ?? 0)
            ? "min"
            : "max",
        index: series.values.length - 1,
        timestamp: series.values[series.values.length - 1].timestamp,
        value: series.values[series.values.length - 1].value,
      } as LocalExtremum,
    ];

    // Remove duplicates at start/end if they coincide with extrema
    const uniquePoints = allPoints.filter((point, i) => {
      if (i === 0) return true;
      return Math.abs(point.timestamp - allPoints[i - 1].timestamp) > 0.01;
    });

    // Create nodes for each segment
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const startPoint = uniquePoints[i];
      const endPoint = uniquePoints[i + 1];

      const rangeMin = Math.min(startPoint.value, endPoint.value);
      const rangeMax = Math.max(startPoint.value, endPoint.value);
      const durationMs = (endPoint.timestamp - startPoint.timestamp) * 1000;

      // Determine node type based on direction
      const nodeType: "uphill" | "downhill" | undefined =
        endPoint.value > startPoint.value ? "uphill" : "downhill";

      nodesWithTiming.push({
        node: {
          id: generateNodeId(signalName, rangeMin, rangeMax),
          type: nodeType,
          signal: signalName,
          range: [
            Math.round(rangeMin - ANGLE_NOISE_TOLERANCE),
            Math.round(rangeMax + ANGLE_NOISE_TOLERANCE),
          ],
          hold_ms: Math.max(MIN_HOLD_MS, Math.round(durationMs)),
          emit: true,
        },
        startTimestamp: startPoint.timestamp,
        endTimestamp: endPoint.timestamp,
        durationMs,
      });
    }
  }

  return nodesWithTiming;
}

/**
 * Creates sync nodes for nodes that coincide in time
 */
export function createSyncNodes(
  nodesWithTiming: NodeWithTiming[],
  timeTolerance: number = SYNC_TIME_TOLERANCE_MS,
): EventNode[] {
  const syncNodes: EventNode[] = [];
  const toleranceSec = timeTolerance / 1000;

  // Group nodes by their end timestamp (with tolerance)
  const endTimeGroups = new Map<number, NodeWithTiming[]>();

  for (const nodeWithTiming of nodesWithTiming) {
    // Round to tolerance bucket
    const bucket = Math.round(nodeWithTiming.endTimestamp / toleranceSec);
    if (!endTimeGroups.has(bucket)) {
      endTimeGroups.set(bucket, []);
    }
    endTimeGroups.get(bucket)!.push(nodeWithTiming);
  }

  // Create sync nodes for groups with 2+ nodes
  let syncCounter = 0;
  for (const [, group] of endTimeGroups) {
    if (group.length >= 2) {
      // Check if these nodes are from different signals (more meaningful sync)
      const signals = new Set(group.map((n) => n.node.signal));
      if (signals.size >= 2) {
        syncCounter++;
        syncNodes.push({
          id: `sync_${syncCounter}`,
          type: "sync",
          requires: group.map((n) => n.node.id),
          emit: true,
        });
      }
    }
  }

  return syncNodes;
}

/**
 * Creates edges connecting nodes in temporal order
 */
export function createEdges(
  nodesWithTiming: NodeWithTiming[],
  syncNodes: EventNode[],
): EventEdge[] {
  const edges: EventEdge[] = [];

  // Sort nodes by start timestamp
  const sortedNodes = [...nodesWithTiming].sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );

  // Group nodes by signal to create sequential edges within each signal
  const signalNodes = new Map<string, NodeWithTiming[]>();
  for (const node of sortedNodes) {
    const signal = node.node.signal || "";
    if (!signalNodes.has(signal)) {
      signalNodes.set(signal, []);
    }
    signalNodes.get(signal)!.push(node);
  }

  // Create edges within each signal
  for (const [, nodes] of signalNodes) {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        from: nodes[i].node.id,
        to: nodes[i + 1].node.id,
      });
    }
  }

  // Add edges from regular nodes to sync nodes
  for (const syncNode of syncNodes) {
    if (syncNode.requires) {
      for (const requiredId of syncNode.requires) {
        edges.push({
          from: requiredId,
          to: syncNode.id,
        });
      }
    }
  }

  // Add edges from sync nodes to the next nodes in sequence
  // This connects sync nodes to nodes that start after them
  for (const syncNode of syncNodes) {
    // Find the timestamp of the sync (latest end time of required nodes)
    const requiredNodes = nodesWithTiming.filter(
      (n) => syncNode.requires?.includes(n.node.id),
    );
    if (requiredNodes.length === 0) continue;

    const syncTimestamp = Math.max(...requiredNodes.map((n) => n.endTimestamp));

    // Find nodes that start right after this sync
    for (const [, nodes] of signalNodes) {
      for (const node of nodes) {
        // Check if this node starts close to the sync timestamp and isn't in the required list
        if (
          Math.abs(node.startTimestamp - syncTimestamp) < 0.1 &&
          !syncNode.requires?.includes(node.node.id)
        ) {
          edges.push({
            from: syncNode.id,
            to: node.node.id,
          });
        }
      }
    }
  }

  // Remove duplicate edges
  const uniqueEdges = edges.filter(
    (edge, index, self) =>
      index === self.findIndex((e) => e.from === edge.from && e.to === edge.to),
  );

  return uniqueEdges;
}

/**
 * Creates time constraints based on node sequence
 */
export function createTimeConstraints(
  nodesWithTiming: NodeWithTiming[],
  edges: EventEdge[],
): TimeConstraint[] {
  const constraints: TimeConstraint[] = [];

  // Create constraints for consecutive nodes
  for (const edge of edges) {
    const fromNode = nodesWithTiming.find((n) => n.node.id === edge.from);
    const toNode = nodesWithTiming.find((n) => n.node.id === edge.to);

    if (fromNode && toNode) {
      const transitionTime =
        (toNode.startTimestamp - fromNode.endTimestamp) * 1000;

      // Only create constraint if there's a meaningful gap
      if (Math.abs(transitionTime) > 10) {
        constraints.push({
          id: `constraint_${edge.from}_to_${edge.to}`,
          from: edge.from,
          to: edge.to,
          min_ms: Math.max(0, Math.round(transitionTime * 0.5)),
          max_ms: Math.round(transitionTime * 2),
          severity: "soft",
        });
      }
    }
  }

  return constraints;
}

/**
 * Creates completion criteria from terminal nodes
 */
export function createCompletion(
  nodesWithTiming: NodeWithTiming[],
  edges: EventEdge[],
): CompletionCriteria {
  // Handle empty case
  if (nodesWithTiming.length === 0) {
    console.log("[createCompletion] No nodes, returning empty completion");
    return { terminal_nodes: [] };
  }

  // Find terminal nodes (nodes with no outgoing edges)
  const nodesWithOutgoing = new Set(edges.map((e) => e.from));
  const allNodeIds = nodesWithTiming.map((n) => n.node.id);

  const terminalNodes = allNodeIds.filter((id) => !nodesWithOutgoing.has(id));

  // If no terminal nodes found, use the last nodes by timestamp
  if (terminalNodes.length === 0) {
    const sortedByEnd = [...nodesWithTiming].sort(
      (a, b) => b.endTimestamp - a.endTimestamp,
    );
    return {
      terminal_nodes: sortedByEnd.slice(0, 2).map((n) => n.node.id),
    };
  }

  return {
    terminal_nodes: terminalNodes,
  };
}

/**
 * Generates a complete event graph from recording angles
 */
export function generateEventGraph(
  recordingAngles: RecordingAngle[],
): {
  signals: Record<string, SignalDef>;
  eventGraph: EventGraph;
  timeConstraints: TimeConstraint[];
  completion: CompletionCriteria;
} {
  console.log("[generateEventGraph] Input recording angles:", recordingAngles.length, "frames");
  
  // Step 1: Create signals from angles with movement
  const signals = createSignals(recordingAngles);
  console.log("[generateEventGraph] Signals created:", Object.keys(signals));

  // Step 2: Create nodes based on angle values
  const nodesWithTiming = createNodes(recordingAngles, signals);
  console.log("[generateEventGraph] Nodes with timing:", nodesWithTiming.length);

  // Step 3: Create sync nodes for coinciding nodes
  const syncNodes = createSyncNodes(nodesWithTiming);
  console.log("[generateEventGraph] Sync nodes:", syncNodes.length);

  // Step 4: Combine all nodes
  const allNodes: EventNode[] = [
    ...nodesWithTiming.map((n) => n.node),
    ...syncNodes,
  ];

  // Step 5: Create edges
  const edges = createEdges(nodesWithTiming, syncNodes);
  console.log("[generateEventGraph] Edges:", edges.length);

  // Step 6: Create time constraints
  const timeConstraints = createTimeConstraints(nodesWithTiming, edges);

  // Step 7: Create completion criteria
  const completion = createCompletion(nodesWithTiming, edges);
  console.log("[generateEventGraph] Completion terminal nodes:", completion.terminal_nodes);

  return {
    signals,
    eventGraph: {
      nodes: allNodes,
      edges,
    },
    timeConstraints,
    completion,
  };
}
