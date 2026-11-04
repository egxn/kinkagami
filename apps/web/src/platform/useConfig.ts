import { useCallback, useSyncExternalStore } from "react";
import type { AppConfig } from "@kgm/core";
import { configStore } from "./configStore";

export function useConfig() {
  const config = useSyncExternalStore(
    (onStoreChange) => configStore.subscribe(() => onStoreChange()),
    configStore.get,
  );
  const patch = useCallback(
    (updates: Partial<AppConfig>) => configStore.update(updates),
    [],
  );
  return { config, patch };
}
