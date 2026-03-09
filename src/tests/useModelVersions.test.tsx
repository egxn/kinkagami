import { act, useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useModelVersions } from "../hooks/useModelVersions";
import {
  DEFAULT_MODEL_VERSIONS,
  MODEL_VERSIONS_STORAGE_KEY,
  type ModelVersionsConfig,
} from "../utils/modelVersions";

interface ProbeState {
  config: ModelVersionsConfig;
  updateConfig: (updates: Partial<ModelVersionsConfig>) => ModelVersionsConfig;
}

function Probe({ onState }: { onState: (state: ProbeState) => void }) {
  const state = useModelVersions();

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  return <div id="cfg">{JSON.stringify(state.config)}</div>;
}

describe("useModelVersions", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    window.localStorage.clear();
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("starts with lightweight defaults", async () => {
    let latest: ProbeState | null = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          onState={(state) => {
            latest = state;
          }}
        />,
      );
    });

    const state = latest as unknown as ProbeState;
    expect(state.config).toEqual(DEFAULT_MODEL_VERSIONS);
    expect(container.textContent).toContain('"movenet":"lightning"');
  });

  it("updates and persists config via updateConfig", async () => {
    let latest: ProbeState | null = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          onState={(state) => {
            latest = state;
          }}
        />,
      );
    });

    await act(async () => {
      const state = latest as unknown as ProbeState;
      state.updateConfig({ movenet: "thunder", handpose: "full" });
    });

    const state = latest as unknown as ProbeState;
    expect(state.config.movenet).toBe("thunder");
    expect(state.config.handpose).toBe("full");

    const raw = window.localStorage.getItem(MODEL_VERSIONS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).toContain('"movenet":"thunder"');
  });

  it("reacts to storage event changes", async () => {
    let latest: ProbeState | null = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Probe
          onState={(state) => {
            latest = state;
          }}
        />,
      );
    });

    await act(async () => {
      window.localStorage.setItem(
        MODEL_VERSIONS_STORAGE_KEY,
        JSON.stringify({
          movenet: "thunder",
          blazepose: "heavy",
          handpose: "full",
        }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: MODEL_VERSIONS_STORAGE_KEY }));
    });

    const state = latest as unknown as ProbeState;
    expect(state.config).toEqual({
      movenet: "thunder",
      blazepose: "heavy",
      handpose: "full",
    });
  });
});
