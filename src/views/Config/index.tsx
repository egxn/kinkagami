import { useMemo } from "react";
import { useAppConfig } from "../../hooks/useAppConfig";
import {
  type CameraFlowType,
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type EvaluationType,
  type PoseModelType,
  type RuntimeExecutionType,
  type TFBackendType,
} from "../../utils/appConfig";
import type {
  BlazePoseVersion,
  HandPoseVersion,
  MoveNetVersion,
} from "../../utils/modelVersions";

const sectionStyle: React.CSSProperties = {
  background: "rgba(12, 24, 32, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
};

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px minmax(220px, 1fr)",
  gap: 12,
  alignItems: "center",
  marginBottom: 10,
};

export default function Config() {
  const { config, patchConfig, replaceConfig } = useAppConfig();

  const jsonPreview = useMemo(() => JSON.stringify(config, null, 2), [config]);

  const setPoseModel = (poseModel: PoseModelType) => {
    patchConfig({ models: { poseModel } as AppConfig["models"] });
  };

  const setMoveNetVersion = (movenet: MoveNetVersion) => {
    patchConfig({ models: { movenet } as AppConfig["models"] });
  };

  const setBlazePoseVersion = (blazepose: BlazePoseVersion) => {
    patchConfig({ models: { blazepose } as AppConfig["models"] });
  };

  const setHandPoseVersion = (handpose: HandPoseVersion) => {
    patchConfig({ models: { handpose } as AppConfig["models"] });
  };

  const setRuntimeExecution = (execution: RuntimeExecutionType) => {
    patchConfig({ runtime: { ...config.runtime, execution } });
  };

  const setTFBackend = (backend: TFBackendType) => {
    patchConfig({ runtime: { ...config.runtime, backend } });
  };

  const setEvaluationType = (type: EvaluationType) => {
    patchConfig({ evaluation: { type } });
  };

  const setCameraFlow = (flow: CameraFlowType) => {
    patchConfig({
      camera: {
        ...config.camera,
        flow,
        source: flow,
      },
    });
  };

  const setCameraStreamUrl = (streamUrl: string) => {
    patchConfig({
      camera: {
        ...config.camera,
        streamUrl,
      },
    });
  };

  const resetDefaults = () => {
    replaceConfig(DEFAULT_APP_CONFIG);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        color: "white",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Config</h1>
      <p style={{ opacity: 0.9 }}>
        Carga por defecto desde JSON y guarda cada cambio en localStorage.
      </p>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Modelos</h2>

        <div style={rowStyle}>
          <label htmlFor="cfg-pose-model">Modelo de pose activo</label>
          <select
            id="cfg-pose-model"
            value={config.models.poseModel}
            onChange={(event) =>
              setPoseModel(event.target.value as PoseModelType)
            }
            style={selectStyle}
          >
            <option value="movenet">MoveNet</option>
            <option value="blazepose">BlazePose</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label htmlFor="cfg-movenet">Versión MoveNet</label>
          <select
            id="cfg-movenet"
            value={config.models.movenet}
            onChange={(event) =>
              setMoveNetVersion(event.target.value as MoveNetVersion)
            }
            style={selectStyle}
          >
            <option value="lightning">lightning</option>
            <option value="thunder">thunder</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label htmlFor="cfg-blazepose">Versión BlazePose</label>
          <select
            id="cfg-blazepose"
            value={config.models.blazepose}
            onChange={(event) =>
              setBlazePoseVersion(event.target.value as BlazePoseVersion)
            }
            style={selectStyle}
          >
            <option value="lite">lite</option>
            <option value="full">full</option>
            <option value="heavy">heavy</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label htmlFor="cfg-handpose">Versión HandPose</label>
          <select
            id="cfg-handpose"
            value={config.models.handpose}
            onChange={(event) =>
              setHandPoseVersion(event.target.value as HandPoseVersion)
            }
            style={selectStyle}
          >
            <option value="lite">lite</option>
            <option value="full">full</option>
          </select>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Camara</h2>
        <div style={rowStyle}>
          <label htmlFor="cfg-camera-flow">Origen del flujo</label>
          <select
            id="cfg-camera-flow"
            value={config.camera.source}
            onChange={(event) =>
              setCameraFlow(event.target.value as CameraFlowType)
            }
            style={selectStyle}
          >
            <option value="web">web</option>
            <option value="streamUrl">streamUrl</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label htmlFor="cfg-camera-stream-url">URL stream</label>
          <input
            id="cfg-camera-stream-url"
            type="text"
            value={config.camera.streamUrl}
            onChange={(event) => setCameraStreamUrl(event.target.value)}
            placeholder="http://localhost:8090/?action=stream"
            disabled={config.camera.source !== "streamUrl"}
            style={selectStyle}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Ejecucion</h2>
        <div style={rowStyle}>
          <label htmlFor="cfg-runtime-exec">Modo</label>
          <select
            id="cfg-runtime-exec"
            value={config.runtime.execution}
            onChange={(event) =>
              setRuntimeExecution(event.target.value as RuntimeExecutionType)
            }
            style={selectStyle}
          >
            <option value="workers">workers</option>
            <option value="site">site</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label htmlFor="cfg-tf-backend">Backend TensorFlow</label>
          <select
            id="cfg-tf-backend"
            value={config.runtime.backend ?? "webgl"}
            onChange={(event) =>
              setTFBackend(event.target.value as TFBackendType)
            }
            style={selectStyle}
          >
            <option value="webgl">webgl (GPU)</option>
            <option value="wasm">wasm (CPU)</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label htmlFor="cfg-evaluation-type">Evaluacion</label>
          <select
            id="cfg-evaluation-type"
            value={config.evaluation.type}
            onChange={(event) =>
              setEvaluationType(event.target.value as EvaluationType)
            }
            style={selectStyle}
          >
            <option value="fsm">fsm</option>
            <option value="grid">grid</option>
          </select>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Config actual (localStorage)</h2>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(0,0,0,0.4)",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {jsonPreview}
        </pre>
      </section>

      <button
        type="button"
        onClick={resetDefaults}
        style={{
          ...selectStyle,
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        Restaurar defaults (JSON)
      </button>
    </div>
  );
}
