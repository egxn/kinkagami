import type { AppConfig } from "../config/appConfig";
import type { Unsubscribe } from "./repositories";

/** Local-first configuration storage (localStorage, AsyncStorage, ...). */
export interface ConfigStore {
  get(): AppConfig;
  save(next: AppConfig): AppConfig;
  update(updates: Partial<AppConfig>): AppConfig;
  subscribe(onChange: (config: AppConfig) => void): Unsubscribe;
}
