import { useAppConfig } from "../hooks";
import { useCameraSource } from "../hooks";
import { DevInfoSnackbar as DevInfoSnackbarUI } from "../ui";

export default function DevInfoSnackbar() {
  const { config } = useAppConfig();
  const cameraSource = useCameraSource();

  const { poseModel, movenet, blazepose } = config.models;
  const modelLabel =
    poseModel === "movenet" ? `movenet/${movenet}` : `blazepose/${blazepose}`;
  const cameraLabel = cameraSource.flow;
  const backendLabel =
    config.runtime.execution === "python"
      ? `python (${config.runtime.backend})`
      : config.runtime.execution;

  return (
    <DevInfoSnackbarUI
      modelLabel={modelLabel}
      cameraLabel={cameraLabel}
      backendLabel={backendLabel}
    />
  );
}
