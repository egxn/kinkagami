import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { loadAllExercises } from "../../services/exerciseManager";
import { FilterBar } from "../../components/FilterBar";
import { ExerciseCard } from "../../components/ExerciseCard";
import { RoutinePanel } from "../../components/RoutinePanel";
import { useTranslation } from "react-i18next";
import "./Menu.scss";

export default function Menu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");

  // Load exercises (in a real app this might be async/useEffect)
  const allExercises = useMemo(() => loadAllExercises(), []);

  const filteredExercises = useMemo(() => {
    return filteredExercisesHelper(
      allExercises,
      searchTerm,
      difficultyFilter,
      muscleFilter,
    );
  }, [allExercises, searchTerm, difficultyFilter, muscleFilter]);

  // Infinite scroll simulation: just slice the list for now
  // Real implementation would track scroll position and increment visibleCount
  const [visibleCount, setVisibleCount] = useState(20);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop ===
      e.currentTarget.clientHeight;
    if (bottom) {
      setVisibleCount((prev) => prev + 20);
    }
  };

  return (
    <div className="menu-view">
      <header className="header">
        <h1>{t("menu.start")}</h1>{" "}
        {/* Reusing 'start' or create a new key 'library'? Plan said 'menu.start' but here it was 'Exercise Library'. Let's check en.json */}
        {/* en.json has "start": "START". The H1 was "Exercise Library". I should probably add "library" key or use "creator" if it was that.
           The plan said: "Menu: menu.start, menu.settings..." referring to specific menu items if this was a main menu.
           But this view IS the menu/library.
           Let's look at en.json again.
        */}
        <div className="header-actions">
          <button onClick={() => navigate("/player")}>Player</button>
          <button onClick={() => navigate("/create")}>Create</button>
          <button onClick={() => setIsRoutineOpen(true)}>Open Routine</button>
        </div>
      </header>

      <FilterBar
        onSearchChange={setSearchTerm}
        onDifficultyChange={setDifficultyFilter}
        onMuscleChange={setMuscleFilter}
      />

      <div className="scroll-area" onScroll={handleScroll}>
        <div className="grid-container">
          {filteredExercises.slice(0, visibleCount).map((exercise) => (
            <ExerciseCard key={exercise.exercise_id} exercise={exercise} />
          ))}
        </div>

        {filteredExercises.length === 0 && (
          <div
            className="empty-message"
            style={{ padding: "32px", textAlign: "center", color: "#888" }}
          >
            No exercises found.
          </div>
        )}
      </div>

      <RoutinePanel
        isOpen={isRoutineOpen}
        onClose={() => setIsRoutineOpen(false)}
      />
    </div>
  );
}

// Helper extracted to avoid variable scope issues in code block replacement if needed,
// but actually I'll just keep it inline or rely on the previous logic.
// Wait, I replaced the whole file content mostly?
// I need `filteredExercisesHelper`? No, I just need to keep the original logic.
// The replace block below reconstructs the component with original logic + new classes.
function filteredExercisesHelper(
  all: any[],
  search: string,
  diff: string,
  muscle: string,
) {
  return all.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty = diff ? ex.difficulty === diff : true;
    const matchesMuscle = muscle
      ? ex.muscle_groups.some((m: string) => m.includes(muscle))
      : true;
    return matchesSearch && matchesDifficulty && matchesMuscle;
  });
}
