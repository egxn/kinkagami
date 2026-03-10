import { useEffect, useState } from "react";
import {
  APP_CONFIG_EVENT,
  getAppConfig,
  saveAppConfig,
  updateAppConfig,
  type AppConfig,
} from "../utils/appConfig";

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(() => getAppConfig());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("kgm-app-config")) {
        setConfig(getAppConfig());
      }
    };

    const onConfigChanged = (event: Event) => {
      const custom = event as CustomEvent<AppConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
        return;
      }
      setConfig(getAppConfig());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(APP_CONFIG_EVENT, onConfigChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APP_CONFIG_EVENT, onConfigChanged);
    };
  }, []);

  const replaceConfig = (next: AppConfig) => {
    const saved = saveAppConfig(next);
    setConfig(saved);
    return saved;
  };

  const patchConfig = (updates: Partial<AppConfig>) => {
    const next = updateAppConfig(updates);
    setConfig(next);
    return next;
  };

  return {
    config,
    replaceConfig,
    patchConfig,
  };
}