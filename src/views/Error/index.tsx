import usePoseContext from "../../context/usePoseContext";

export default function Error() {
  const { cameraError, modelError } = usePoseContext();

  return (
    <div className="error-screen">
      <h1>Error</h1>
      <p>Something went wrong during initialization</p>
      {cameraError && (
        <div>
          <p><strong>Camera Error:</strong> {cameraError}</p>
        </div>
      )}
      {modelError && (
        <div>
          <p><strong>Model Error:</strong> {modelError}</p>
        </div>
      )}
    </div>
  );
}
