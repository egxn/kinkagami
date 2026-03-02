import { useSessionComparison } from "../../context/useSessionComparison";
import "./Score.scss";

export default function Score() {
  const { snapshot } = useSessionComparison();
  const completionPercent = Math.max(
    0,
    Math.min(100, snapshot.completion * 100),
  );
  const gridPercent = Math.max(0, Math.min(100, snapshot.gridProgress * 100));

  return (
    <>
      <div className="score-overlay">
        <div className="score-overlay__title">Score</div>
        <div className="score-overlay__value">{snapshot.score}</div>
        <div className="score-overlay__meta">
          <span>
            Nodos: {snapshot.matchedCount}/{snapshot.totalNodes}
          </span>
          <span>Progreso: {completionPercent.toFixed(0)}%</span>
          <span>Actual: {snapshot.currentNodeId ?? "-"}</span>
        </div>
      </div>

      <div className="score-overlay score-overlay--right">
        <div className="score-overlay__title">Cumplimiento</div>
        <div className="score-overlay__value">
          {completionPercent.toFixed(0)}%
        </div>
        <div className="score-overlay__meta">
          <span>Repetición objetivo: 1</span>
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
              <span>Grid progreso: {gridPercent.toFixed(0)}%</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
