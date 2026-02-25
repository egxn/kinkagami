import { RoutinesView } from "../Routines";
import Exercises from "../Exercises";
import Canvas from "../Canvas";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRoutines } from "../../hooks/useRoutines";
import ScoreTrainerLayers from "./ScoreTrainerLayers";

import "./Stack.scss";

export default function Stack() {
  const { routines, loading, deleteRoutineData } = useRoutines();

  return (
    <div className="stack-container">
      <Routes>
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
                onDeleteRoutine={(id) => deleteRoutineData(id)}
              />
            </div>
          }
        />
        <Route
          path="exercises"
          element={
            <div className="stack-layer">
              <Exercises />
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
