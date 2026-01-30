export type BodyPart =
  | "nose"
  | "left_eye"
  | "right_eye"
  | "left_ear"
  | "right_ear"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle";

export interface SignalDef {
  type: "angle" | "distance" | "relative_position";
  points: BodyPart[];
}

export interface EventNode {
  id: string;
  type?: "uphill" | "downhill" | "sync"; // default implies simple check
  signal?: string; // key in signals map
  range?: [number, number]; // [min, max]
  hold_ms?: number;
  emit?: boolean; // if true, emits an event when active/completed
  requires?: string[]; // for sync nodes, list of node IDs to wait for
}

export interface EventEdge {
  from: string;
  to: string;
}

export interface EventGraph {
  nodes: EventNode[];
  edges: EventEdge[];
}

export interface TimeConstraint {
  id: string;
  from: string;
  to: string;
  min_ms?: number;
  max_ms?: number;
  severity: "soft" | "hard";
}

export interface CompletionCriteria {
  terminal_nodes: string[];
}

export interface ExerciseDef {
  exercise_id: string;
  name: string;
  description: string;
  muscle_groups: string[];
  difficulty: "beginner" | "intermedio" | "advanced" | string;
  instructions: string[];
  signals: Record<string, SignalDef>;
  event_graph: EventGraph;
  time_constraints?: TimeConstraint[];
  completion: CompletionCriteria;
  metadata?: {
    version: string;
    created_at?: string;
    updated_at?: string;
  };
}
