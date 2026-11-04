import type { AppConfig, ConfigStore } from "@kgm/core";
import {
  APP_CONFIG_EVENT,
  getAppConfig,
  saveAppConfig,
  updateAppConfig,
} from "../utils/appConfig";

/** localStorage-backed implementation of the core `ConfigStore` port. */
export const configStore: ConfigStore = {
  get: () => getAppConfig(),
  save: (next) => saveAppConfig(next),
  update: (updates) => updateAppConfig(updates),
  subscribe: (onChange) => {
    // Other tabs write localStorage -> `storage`; this tab emits our own event.
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("kgm-app-config")) {
        onChange(getAppConfig());
      }
    };

    const onConfigChanged = (event: Event) => {
      const detail = (event as CustomEvent<AppConfig>).detail;
      onChange(detail ?? getAppConfig());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(APP_CONFIG_EVENT, onConfigChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APP_CONFIG_EVENT, onConfigChanged);
    };
  },
};
