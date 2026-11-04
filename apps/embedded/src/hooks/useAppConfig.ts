import { useEffect, useState } from "react";
import type { AppConfig } from "@kgm/core";
import { configStore } from "../platform/configStore";

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(() => configStore.get());

  useEffect(() => configStore.subscribe(setConfig), []);

  const replaceConfig = (next: AppConfig) => {
    const saved = configStore.save(next);
    setConfig(saved);
    return saved;
  };

  const patchConfig = (updates: Partial<AppConfig>) => {
    const next = configStore.update(updates);
    setConfig(next);
    return next;
  };

  return {
    config,
    replaceConfig,
    patchConfig,
  };
}
