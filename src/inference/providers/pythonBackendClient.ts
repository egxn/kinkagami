import type { Pose } from "@tensorflow-models/pose-detection";
import type {
  BackendModelType,
  HandPrediction,
} from "../../types/inference";
import { KeypointSmoother } from "./keypointSmoother";

type BackendModelVersion =
  | "lightning"
  | "thunder"
  | "lite"
  | "full"
  | "heavy";

interface BackendActiveModel {
  type: BackendModelType;
  version: BackendModelVersion;
  name?: string;
}

interface BackendKeypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
  z?: number;
  visibility?: number;
}

interface BackendPrediction {
  keypoints?: BackendKeypoint[];
  score?: number;
  label?: string;
}

interface BackendResultMessage {
  type: "result";
  activeModel?: BackendActiveModel | null;
  predictions?: BackendPrediction[];
}

interface BackendReadyMessage {
  type: "ready";
  activeModel?: BackendActiveModel | null;
}

interface BackendStatusMessage {
  type: "status";
  running: boolean;
  activeModel?: BackendActiveModel | null;
}

interface BackendErrorMessage {
  type: "error";
  error: string;
}

type BackendMessage =
  | BackendResultMessage
  | BackendReadyMessage
  | BackendStatusMessage
  | BackendErrorMessage;

export interface PythonBackendClientState {
  connected: boolean;
  isLoading: boolean;
  error: string | null;
  activeModel: BackendActiveModel | null;
}

interface EnsureSessionParams {
  url: string;
  modelType: BackendModelType;
  version: BackendModelVersion;
}

type StateListener = (state: PythonBackendClientState) => void;

const EMPTY_STATE: PythonBackendClientState = {
  connected: false,
  isLoading: false,
  error: null,
  activeModel: null,
};

const toPoseArray = (predictions: BackendPrediction[] | undefined): Pose[] =>
  (predictions ?? []).map((prediction) => ({
    score: prediction.score,
    keypoints: (prediction.keypoints ?? []).map((keypoint) => ({
      x: keypoint.x,
      y: keypoint.y,
      score: keypoint.score,
      name: keypoint.name,
    })),
  }));

const toHandArray = (
  predictions: BackendPrediction[] | undefined,
): HandPrediction[] =>
  (predictions ?? []).map((prediction) => ({
    score: prediction.score,
    handedness: prediction.label,
    keypoints: (prediction.keypoints ?? []).map((keypoint) => ({
      x: keypoint.x,
      y: keypoint.y,
      score: keypoint.score,
      name: keypoint.name,
      z: keypoint.z,
    })),
  }));

class PythonBackendClient {
  private socket: WebSocket | null = null;
  private socketUrl: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private pendingReady:
    | {
        key: string;
        resolve: () => void;
        reject: (error: Error) => void;
      }
    | null = null;
  private state: PythonBackendClientState = EMPTY_STATE;
  private latestResult: BackendResultMessage | null = null;
  private listeners = new Set<StateListener>();
  private sessionPromise: Promise<void> | null = null;
  private sessionPromiseKey: string | null = null;
  private poseSmoother = new KeypointSmoother();
  private modelRequests = new Map<string, EnsureSessionParams>();
  private static readonly MODEL_PRIORITY: Record<string, number> = {
    handpose: 10,
    movenet: 1,
    blazepose: 1,
  };
  private reconcilePromise: Promise<void> | null = null;

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState(next: Partial<PythonBackendClientState>) {
    this.state = {
      ...this.state,
      ...next,
    };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private modelKey(model: EnsureSessionParams) {
    return `${model.modelType}:${model.version}`;
  }

  private activeModelKey() {
    const activeModel = this.state.activeModel;
    if (!activeModel) return null;
    return `${activeModel.type}:${activeModel.version}`;
  }

  requestModel(id: string, params: EnsureSessionParams): Promise<void> {
    this.modelRequests.set(id, params);
    return this.scheduleReconcile();
  }

  releaseModel(id: string): void {
    this.modelRequests.delete(id);
    this.scheduleReconcile().catch(() => {});
  }

  private bestRequestedModel(): EnsureSessionParams | null {
    let best: EnsureSessionParams | null = null;
    let bestPriority = -1;
    for (const params of this.modelRequests.values()) {
      const p = PythonBackendClient.MODEL_PRIORITY[params.modelType] ?? 0;
      if (p > bestPriority) {
        best = params;
        bestPriority = p;
      }
    }
    return best;
  }

  /**
   * Serialize reconciliation so only one ensureSession runs at a time.
   * If a reconcile is already in flight, callers chain onto the same promise
   * and a fresh reconcile runs after the current one finishes (in case the
   * desired model changed while waiting).
   */
  private scheduleReconcile(): Promise<void> {
    if (this.reconcilePromise) {
      // A reconcile is already running — chain a follow-up after it finishes
      // so the latest desired model is picked up.
      this.reconcilePromise = this.reconcilePromise
        .catch(() => {})
        .then(() => this.doReconcile());
      return this.reconcilePromise;
    }
    this.reconcilePromise = this.doReconcile().finally(() => {
      this.reconcilePromise = null;
    });
    return this.reconcilePromise;
  }

  private async doReconcile(): Promise<void> {
    const best = this.bestRequestedModel();
    if (!best) return;
    const key = this.modelKey(best);
    if (this.activeModelKey() === key && !this.state.isLoading) return;
    await this.ensureSession(best);
  }

  private async ensureSocket(url: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.socketUrl === url) {
      return;
    }

    if (this.connectPromise && this.socketUrl === url) {
      return this.connectPromise;
    }

    if (this.socket && this.socketUrl !== url) {
      this.socket.close();
      this.socket = null;
    }

    this.socketUrl = url;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        this.emitState({
          connected: true,
          error: null,
        });
        resolve();
      };

      socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        const error = new Error(`Unable to connect to Python backend at ${url}`);
        this.emitState({
          connected: false,
          isLoading: false,
          error: error.message,
        });
        if (this.pendingReady) {
          this.pendingReady.reject(error);
          this.pendingReady = null;
        }
        reject(error);
      };

      socket.onclose = () => {
        this.socket = null;
        this.connectPromise = null;
        if (this.pendingReady) {
          this.pendingReady.reject(new Error("Socket closed"));
          this.pendingReady = null;
        }
        this.emitState({
          connected: false,
          isLoading: false,
          activeModel: null,
        });
      };
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private handleMessage(raw: string) {
    let message: BackendMessage;
    try {
      message = JSON.parse(raw) as BackendMessage;
    } catch {
      return;
    }

    if (message.type === "status") {
      this.emitState({
        connected: true,
        activeModel: message.activeModel ?? null,
      });
      return;
    }

    if (message.type === "ready") {
      this.latestResult = null;
      this.emitState({
        connected: true,
        isLoading: false,
        error: null,
        activeModel: message.activeModel ?? null,
      });

      const pendingReady = this.pendingReady;
      if (
        pendingReady &&
        message.activeModel &&
        pendingReady.key ===
          `${message.activeModel.type}:${message.activeModel.version}`
      ) {
        pendingReady.resolve();
        this.pendingReady = null;
      }
      return;
    }

    if (message.type === "result") {
      this.latestResult = message;
      this.emitState({
        connected: true,
        activeModel: message.activeModel ?? this.state.activeModel,
      });
      return;
    }

    if (message.type === "error") {
      this.emitState({
        isLoading: false,
        error: message.error,
      });
      if (this.pendingReady) {
        this.pendingReady.reject(new Error(message.error));
        this.pendingReady = null;
      }
    }
  }

  async ensureSession(params: EnsureSessionParams) {
    const key = this.modelKey(params);
    if (this.activeModelKey() === key && !this.state.isLoading) {
      return;
    }

    // If a start request is already in flight for the same model, reuse it.
    if (this.sessionPromiseKey === key && this.sessionPromise) {
      return this.sessionPromise;
    }

    await this.ensureSocket(params.url);

    // Re-check after awaiting the socket – another call may have resolved
    // while we were connecting.
    if (this.activeModelKey() === key && !this.state.isLoading) {
      return;
    }
    if (this.sessionPromiseKey === key && this.sessionPromise) {
      return this.sessionPromise;
    }

    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Python backend socket is not open: ${params.url}`);
    }

    this.latestResult = null;
    this.poseSmoother.reset();
    this.emitState({
      isLoading: true,
      error: null,
    });

    // Reject any previous pending ready that this new session supersedes.
    if (this.pendingReady) {
      this.pendingReady.reject(new Error("Session superseded"));
      this.pendingReady = null;
    }

    const readyPromise = new Promise<void>((resolve, reject) => {
      this.pendingReady = {
        key,
        resolve,
        reject,
      };
    });

    this.sessionPromise = readyPromise;
    this.sessionPromiseKey = key;

    readyPromise
      .finally(() => {
        if (this.sessionPromise === readyPromise) {
          this.sessionPromise = null;
          this.sessionPromiseKey = null;
        }
      });

    socket.send(
      JSON.stringify({
        type: "start",
        model: {
          type: params.modelType,
          version: params.version,
        },
      }),
    );

    return readyPromise;
  }

  async estimatePoses(params: EnsureSessionParams): Promise<Pose[]> {
    // Don't call ensureSession here – the eager useEffect manages the active
    // model.  Calling it per-frame would fight with the hand estimator which
    // requests a different model, causing constant model switching.
    const key = this.modelKey(params);
    if (this.activeModelKey() !== key) return [];
    const raw = toPoseArray(this.latestResult?.predictions);
    return this.poseSmoother.smooth(raw);
  }

  async estimateHands(params: EnsureSessionParams): Promise<HandPrediction[]> {
    const key = this.modelKey(params);
    if (this.activeModelKey() !== key) return [];
    return toHandArray(this.latestResult?.predictions);
  }
}

export const pythonBackendClient = new PythonBackendClient();
