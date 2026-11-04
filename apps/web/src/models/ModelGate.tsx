import { useEffect, useState, type ReactNode } from "react";
import type { MoveNetVersion } from "@kgm/core";
import { downloadModel, getMoveNetModelUrl, isModelCached } from "./modelCache";

type GateState =
  | { status: "checking" }
  | { status: "downloading"; ratio: number; loadedBytes: number }
  | { status: "ready" }
  | { status: "error"; message: string };

interface ModelGateProps {
  version: MoveNetVersion;
  children: ReactNode;
}

const toMegabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/**
 * Blocks the app until the pose model is available locally. First visit shows
 * download progress; later visits resolve straight from the cache.
 */
export default function ModelGate({ version, children }: ModelGateProps) {
  const [state, setState] = useState<GateState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const url = getMoveNetModelUrl(version);

    const run = async () => {
      try {
        if (await isModelCached(url)) {
          setState({ status: "ready" });
          return;
        }
        setState({ status: "downloading", ratio: 0, loadedBytes: 0 });
        await downloadModel(
          url,
          ({ ratio, loadedBytes }) =>
            setState({ status: "downloading", ratio, loadedBytes }),
          controller.signal,
        );
        setState({ status: "ready" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void run();
    return () => controller.abort();
  }, [version, attempt]);

  if (state.status === "ready") return <>{children}</>;

  return (
    <main className="gate">
      <h1>Kinkagami</h1>
      {state.status === "checking" && <p>Comprobando modelos…</p>}
      {state.status === "downloading" && (
        <>
          <p>Descargando modelo de pose (solo la primera vez)</p>
          <progress max={1} value={state.ratio} />
          <p className="muted">
            {Math.round(state.ratio * 100)}% · {toMegabytes(state.loadedBytes)}{" "}
            MB
          </p>
        </>
      )}
      {state.status === "error" && (
        <>
          <p className="error">{state.message}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
        </>
      )}
    </main>
  );
}
