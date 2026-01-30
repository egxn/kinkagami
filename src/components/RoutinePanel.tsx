import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRoutine } from "../context/RoutineContext";
import type { RoutineItem } from "../context/RoutineContext";
import { getExerciseById, loadAllExercises } from "../services/exerciseManager";

import "./RoutinePanel.scss";

// --- Sortable Item Component ---
const SortableItem = ({
  item,
  onDelete,
}: {
  item: RoutineItem;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const exercises = loadAllExercises();
  const exercise = getExerciseById(exercises, item.exerciseId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-item"
      {...attributes}
      {...listeners}
    >
      <div className="item-content">
        <div className="item-name">{exercise?.name || item.exerciseId}</div>
        <div className="item-details">
          {item.reps} reps x {item.sets} sets
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation(); // prevent drag start on click
          onDelete();
        }}
        className="delete-btn"
      >
        ✕
      </button>
    </div>
  );
};

// --- Main Panel Component ---
interface RoutinePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoutinePanel: React.FC<RoutinePanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { routine, removeFromRoutine, reorderRoutine } = useRoutine();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = routine.findIndex((item) => item.id === active.id);
      const newIndex = routine.findIndex((item) => item.id === over?.id);
      reorderRoutine(oldIndex, newIndex);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="routine-panel">
      <div className="header">
        <h2>My Routine</h2>
        <button onClick={onClose}>✕</button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={routine.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {routine.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onDelete={() => removeFromRoutine(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {routine.length === 0 && (
        <p className="empty-state">
          Drag exercises here or add them from the menu.
        </p>
      )}
    </div>
  );
};
