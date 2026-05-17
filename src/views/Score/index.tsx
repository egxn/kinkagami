import { useSessionComparison } from "../../context/useSessionComparison";
import "./Score.scss";

export default function Score() {
  const { snapshot } = useSessionComparison();

  return (
    <>
      <div className="score-overlay">
        <div className="score-overlay__title">Progreso</div>
        <div className="score-overlay__value">
          {Math.round(snapshot.progressScore)}%
        </div>
        <div className="score-overlay__meta">
          <span>
            Nodos: {snapshot.matchedCount}/{snapshot.totalNodes}
          </span>
          <span>Actual: {snapshot.currentNodeId ?? "-"}</span>
        </div>
        {snapshot.holdProgress > 0 && (
          <div className="score-overlay__hold-bar">
            <div
              className="score-overlay__hold-fill"
              style={{ width: `${snapshot.holdProgress * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="score-overlay score-overlay--right">
        <div className="score-overlay__title">Calidad</div>
        <div className="score-overlay__value">
          {snapshot.qualityScore > 0 ? `${snapshot.qualityScore}%` : "—"}
        </div>
        <div className="score-overlay__meta">
          <span>
            Estado: {snapshot.completed ? "Completada" : "En progreso"}
          </span>
          {snapshot.gridTotalKeypoints > 0 && (
            <>
              <span>Grid: {snapshot.gridScore}%</span>
              <span>
                Grid KP: {snapshot.gridMatchedKeypoints}/
                {snapshot.gridTotalKeypoints}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
