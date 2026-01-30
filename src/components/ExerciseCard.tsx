import React, { useState } from "react";
import type { ExerciseDef } from "../types/exercise";
import { useRoutine } from "../context/RoutineContext";

interface ExerciseCardProps {
  exercise: ExerciseDef;
}

import "./ExerciseCard.scss";

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise }) => {
  const { addToRoutine } = useRoutine();
  const [reps, setReps] = useState(10);
  const [sets, setSets] = useState(3);

  const handleAdd = () => {
    addToRoutine(exercise.exercise_id, reps, sets);
  };

  return (
    <div className="exercise-card">
      <div className="header">
        <h3>{exercise.name}</h3>
        <span className={`difficulty-badge ${exercise.difficulty}`}>
          {exercise.difficulty}
        </span>
      </div>

      <p className="description">{exercise.description}</p>

      <div className="muscle-groups">
        {exercise.muscle_groups.map((muscle) => (
          <span key={muscle}>{muscle}</span>
        ))}
      </div>

      <div className="actions">
        <div className="inputs">
          <label>
            Reps:{" "}
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
            />
          </label>
          <label>
            Sets:{" "}
            <input
              type="number"
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
            />
          </label>
        </div>
        <button onClick={handleAdd}>Add to Routine</button>
      </div>
    </div>
  );
};
