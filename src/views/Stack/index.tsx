import { RoutinesView } from "../Routines";
import Exercises from "../Exercises";
import Canvas from "../Canvas";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRoutines } from "../../hooks/useRoutines";
import ScoreTrainerLayers from "./ScoreTrainerLayers";

import "./Stack.scss";
import Splash from "../Splash";

export default function Stack() {
  const { routines, loading, error, refreshRoutines } = useRoutines();

  return (
    <div className="stack-container">
      <Routes>
        <Route path="splash" element={<Splash />} />
        <Route path="session" element={<ScoreTrainerLayers />} />

        <Route
          index
          element={
            loading ? (
              <div />
            ) : (
              <Navigate to={routines.length > 0 ? "routines" : "exercises"} replace />
            )
          }
        />

        <Route
          path="routines"
          element={
            <div className="stack-layer">
              <RoutinesView
                routines={routines}
                loading={loading}
                error={error}
                onRetry={() => {
                  void refreshRoutines();
                }}
              />
            </div>
          }
        />
        <Route
          path="exercises"
          element={
            <div className="stack-layer">
              <Exercises
                onRoutineCreated={() => {
                  void refreshRoutines();
                }}
              />
            </div>
          }
        />
      </Routes>
      <div className="stack-layer">
        <Canvas />
      </div>
    </div>
  );
}
