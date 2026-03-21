import type { AppConfig } from "../utils/appConfig";
import type { InferenceBackend } from "./types";

export const resolveInferenceBackend = (
  config: AppConfig,
): InferenceBackend => {
  return config.runtime.execution === "python" ? "python" : "browser";
};
