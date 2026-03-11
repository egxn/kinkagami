export type MoveNetModelVersion = "thunder" | "lightning";
export type TFBackendType = "webgl" | "wasm";

export interface WorkerPoseKeypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export interface WorkerPose {
  keypoints: WorkerPoseKeypoint[];
  score?: number;
}

export type MoveNetWorkerRequest =
  | {
      type: "init";
      version: MoveNetModelVersion;
      backend: TFBackendType;
    }
  | {
      type: "estimate";
      requestId: number;
      imageBitmap: ImageBitmap;
    }
  | {
      type: "dispose";
    };

export type MoveNetWorkerResponse =
  | {
      type: "ready";
    }
  | {
      type: "result";
      requestId: number;
      poses: WorkerPose[];
    }
  | {
      type: "error";
      error: string;
      requestId?: number;
    };