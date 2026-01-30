import React from "react";

interface FilterBarProps {
  onSearchChange: (val: string) => void;
  onDifficultyChange: (val: string) => void;
  onMuscleChange: (val: string) => void;
}

import "./FilterBar.scss";

export const FilterBar: React.FC<FilterBarProps> = ({
  onSearchChange,
  onDifficultyChange,
  onMuscleChange,
}) => {
  return (
    <div className="filter-bar">
      <input
        type="text"
        placeholder="Search..."
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select onChange={(e) => onDifficultyChange(e.target.value)}>
        <option value="">All Difficulties</option>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>

      <select onChange={(e) => onMuscleChange(e.target.value)}>
        <option value="">All Muscles</option>
        {/* Ideally these should be dynamic, but hardcoding common ones for now */}
        <option value="legs">Legs</option>
        <option value="arms">Arms</option>
        <option value="core">Core</option>
        <option value="back">Back</option>
        <option value="chest">Chest</option>
      </select>
    </div>
  );
};
