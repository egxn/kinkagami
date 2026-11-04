import type { Pose } from "../pose/types";

/**
 * Contract for anything that turns a camera frame into poses. `TFrame` is the
 * client's native frame type (HTMLVideoElement on web, a native frame on
 * mobile), so core never references DOM types.
 */
export interface PoseSource<TFrame = unknown> {
  detect(frame: TFrame): Promise<Pose[]>;
  dispose?(): void;
}
