import { useEffect, useState } from "react";
import {
  MODEL_VERSIONS_EVENT,
  getModelVersionsConfig,
  saveModelVersionsConfig,
  type ModelVersionsConfig,
} from "../utils/modelVersions";

export function useModelVersions() {
  const [config, setConfig] = useState<ModelVersionsConfig>(() =>
    getModelVersionsConfig(),
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("kgm-model-versions")) {
        setConfig(getModelVersionsConfig());
      }
    };

    const onConfigChanged = (event: Event) => {
      const custom = event as CustomEvent<ModelVersionsConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
        return;
      }
      setConfig(getModelVersionsConfig());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(MODEL_VERSIONS_EVENT, onConfigChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MODEL_VERSIONS_EVENT, onConfigChanged);
    };
  }, []);

  const updateConfig = (updates: Partial<ModelVersionsConfig>) => {
    const next = saveModelVersionsConfig(updates);
    setConfig(next);
    return next;
  };

  return {
    config,
    updateConfig,
  };
}
