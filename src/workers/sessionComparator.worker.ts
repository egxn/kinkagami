import type { Pose } from "@tensorflow-models/pose-detection";
import {
  createSessionComparator,
  type SessionComparator,
  type SessionComparatorSnapshot,
} from "../services/sessionComparator";
import type {
  SessionComparatorWorkerRequest,
  SessionComparatorWorkerResponse,
} from "./sessionComparatorMessages";

const EMPTY_SNAPSHOT: SessionComparatorSnapshot = {
  score: 0,
  matchedCount: 0,
  totalNodes: 0,
  currentNodeId: null,
  completion: 0,
  completed: false,
  activeSignals: {},
  gridScore: 0,
  gridProgress: 0,
  gridMatchedKeypoints: 0,
  gridTotalKeypoints: 0,
};

let comparator: SessionComparator | null = null;

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SessionComparatorWorkerRequest>) => void) | null;
  postMessage: (message: SessionComparatorWorkerResponse) => void;
};

const postSnapshot = (snapshot: SessionComparatorSnapshot) => {
  workerScope.postMessage({ type: "snapshot", snapshot });
};

const postError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  workerScope.postMessage({ type: "error", error: message });
};

workerScope.onmessage = (
  event: MessageEvent<SessionComparatorWorkerRequest>,
) => {
  try {
    const message = event.data;

    if (message.type === "setExercise") {
      if (!message.exercise) {
        comparator = null;
        postSnapshot(EMPTY_SNAPSHOT);
        return;
      }

      comparator = createSessionComparator(message.exercise);
      postSnapshot(comparator.getSnapshot());
      return;
    }

    if (message.type === "processPose") {
      if (!comparator) return;
      const pose = message.pose as unknown as Pose;
      postSnapshot(comparator.update(pose, message.nowMs));
      return;
    }

    if (message.type === "reset") {
      if (!comparator) {
        postSnapshot(EMPTY_SNAPSHOT);
        return;
      }
      postSnapshot(comparator.reset());
    }
  } catch (error) {
    postError(error);
  }
};
