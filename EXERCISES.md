# 📋 Exercise Definition Guide

## Overview

Exercises in the Smart Fitness Mirror are defined as **versioned JSON files** stored in `src/db/exercises/`.

These JSON files serve as the **source of truth** for exercise behavior and are used to:
- Define muscle groups and difficulty
- Specify joint angles to track
- Create validation rules via FSM and graphs
- Generate visual feedback
- Track progress

---

## File Location

All exercise definitions are stored in:
```
src/db/exercises/
├── index.ts              # Exercise registry
├── 00_sample.json        # Sample exercise (squat with arm raise)
├── 01_pushups.json       # (Coming soon)
└── ...
```

**Important**: Exercise JSON files are **NOT** placed in `/public`. They are loaded programmatically from `src/db/exercises/`.

---

## Loading Strategy

### Import at Runtime
Exercises are loaded into PouchDB during application initialization:

```typescript
import { importExercisesFromJSON, EXERCISE_FILES } from '@/db/exercises';

// Load all available exercises into PouchDB
await importExercisesFromJSON(EXERCISE_FILES);
```

### Why This Approach?
- ✅ Exercises are versioned and tracked
- ✅ Local-first: stored in PouchDB
- ✅ Can be added/updated without rebuilding
- ✅ Separation of concerns: source code vs. content
- ✅ Easy migration to cloud sync in future

---

## Exercise JSON Schema

### Structure
```json
{
  "exercise_id": "unique_identifier",
  "version": "1.0",
  "name": "Exercise Name (Spanish)",
  "description": "Detailed description",
  "muscle_groups": ["quads", "glutes", "hamstrings"],
  "difficulty": "beginner|intermediate|advanced",
  "instructions": ["Step 1", "Step 2", ...],
  
  "signals": {
    "knee_angle": {
      "type": "angle",
      "points": ["hip", "knee", "ankle"]
    },
    ...
  },
  
  "event_graph": {
    "nodes": [...],
    "edges": [...]
  },
  
  "time_constraints": [...],
  
  "completion": {
    "terminal_nodes": [...]
  }
}
```

### Key Fields

#### `exercise_id` (string, required)
Unique identifier for the exercise. Examples:
- `squat_with_arm_raise`
- `pushup_standard`
- `bicep_curl_dumbbell`

#### `version` (string, recommended)
Semantic versioning for exercise definitions. Allows tracking changes:
- `1.0` - Initial version
- `1.1` - Adjusted angle ranges
- `2.0` - Completely redesigned

#### `name` (string, required)
Display name in Spanish (or your language). Used in UI.

#### `description` (string)
Detailed description of the exercise, what muscles it targets, etc.

#### `muscle_groups` (array)
List of targeted muscle groups:
```json
[
  "cuádriceps",
  "glúteos",
  "isquiotibiales",
  "espalda",
  "pecho",
  "hombros",
  "bíceps",
  "tríceps",
  "core"
]
```

#### `difficulty` (string)
- `principiante` - Beginner
- `intermedio` - Intermediate
- `avanzado` - Advanced

#### `instructions` (array)
Step-by-step instructions for performing the exercise:
```json
[
  "Párate con los pies al ancho de los hombros",
  "Mantén la espalda recta",
  "Baja lentamente flexionando las rodillas",
  "Detente cuando los muslos estén paralelos al suelo",
  "Sube empujando a través de los talones"
]
```

#### `signals` (object)
Define which body angles/segments to track:

```json
"signals": {
  "knee_angle": {
    "type": "angle",
    "points": ["hip", "knee", "ankle"]
  },
  "hip_angle": {
    "type": "angle",
    "points": ["shoulder", "hip", "knee"]
  },
  "shoulder_angle": {
    "type": "angle",
    "points": ["elbow", "shoulder", "hip"]
  }
}
```

**Supported Signal Types:**
- `angle` - Angle between 3 keypoints (joint angle)
- `distance` - Distance between 2 points (future)
- `velocity` - Rate of movement (future)

**Available Keypoints** (from MoveNet):
```
0: nose
1: left_eye
2: right_eye
3: left_ear
4: right_ear
5: left_shoulder
6: right_shoulder
7: left_elbow
8: right_elbow
9: left_wrist
10: right_wrist
11: left_hip
12: right_hip
13: left_knee
14: right_knee
15: left_ankle
16: right_ankle
```

#### `event_graph` (object)
Finite state machine definition using directed graph:

```json
"event_graph": {
  "nodes": [
    {
      "id": "knee_flexed",
      "signal": "knee_angle",
      "range": [80, 100],
      "hold_ms": 150,
      "emit": true
    },
    {
      "id": "bottom_reached",
      "type": "sync",
      "requires": ["knee_flexed", "hip_flexed"]
    },
    ...
  ],
  "edges": [
    { "from": "knee_flexed", "to": "bottom_reached" },
    { "from": "bottom_reached", "to": "arms_raised" },
    ...
  ]
}
```

**Node Types:**
- **Signal Node**: `{ "id", "signal", "range", "hold_ms", "emit" }`
  - `signal`: Which signal to monitor
  - `range`: [min, max] angle in degrees
  - `hold_ms`: How long to hold in range before firing
  - `emit`: Whether this triggers downstream nodes

- **Sync Node**: `{ "id", "type": "sync", "requires" }`
  - `requires`: Array of node IDs that must complete before this
  - Ensures parallel movements are coordinated

**Edges:**
- Directed edges define valid transitions
- From → To: When a node fires, which node(s) become active?

#### `time_constraints` (array)
Temporal relationships between nodes:

```json
"time_constraints": [
  {
    "id": "arms_after_bottom",
    "from": "bottom_reached",
    "to": "arms_raised",
    "min_ms": 50,
    "max_ms": 200,
    "severity": "soft"
  }
]
```

- `min_ms`: Minimum time between from → to
- `max_ms`: Maximum time between from → to
- `severity`: 
  - `hard` - Disqualifies the rep if violated
  - `soft` - Penalizes the score but allows completion

#### `completion` (object)
Defines successful exercise completion:

```json
"completion": {
  "terminal_nodes": ["knee_extended", "hip_extended"],
  "min_reps": 1
}
```

- `terminal_nodes`: All of these must be reached to complete the exercise
- `min_reps`: Minimum repetitions required

---

## Example: Squat with Arm Raise

See [00_sample.json](./00_sample.json) for a complete example.

Key features of this exercise:
1. **Parallel movements**: Knees and hips flex simultaneously
2. **Sequential movements**: Arms raise after reaching bottom
3. **Temporal constraints**: Arms must rise within 200ms of bottom
4. **Symmetric**: Left/right movements should be balanced

---

## Adding a New Exercise

### Step 1: Create JSON File
Create a new file in `src/db/exercises/`:
```
src/db/exercises/01_my_exercise.json
```

Follow the naming convention: `XX_exercise_name.json`

### Step 2: Define the Exercise
Fill in all required fields. Use 00_sample.json as a template.

### Step 3: Register in Index
Update `src/db/exercises/index.ts`:
```typescript
export const EXERCISE_FILES = [
  '00_sample',
  '01_my_exercise',  // Add here
] as const;
```

### Step 4: Load at Runtime
The exercise will automatically be loaded when `importExercisesFromJSON()` is called.

### Step 5: Test
- Create sample pose data
- Run through validation engine
- Check FSM transitions
- Verify timing constraints

---

## Validation Rules

### File Naming
- Format: `XX_exercise_name.json`
- `XX` is zero-padded order (00, 01, 02, ...)
- Use snake_case
- Keep names short and descriptive

### Exercise ID
- Must be unique across all exercises
- Use snake_case: `squat_with_arm_raise`
- Should match file name (without 'XX_')

### Signals
- Each signal must reference valid keypoints
- Angle signals require exactly 3 points
- Range values in degrees (0-180)
- `hold_ms` > 0 to debounce jitter

### Event Graph
- At least one named node
- Edges must reference existing nodes
- Sync nodes cannot have incoming signal edges
- Terminal nodes must be reachable

### Constraints
- `min_ms` ≤ `max_ms`
- Both must be ≥ 0

---

## Versioning Strategy

### When to Increment Version

**Patch (1.0.1 → 1.0.2):**
- Tiny adjustments to angle ranges
- Minor hold_ms tweaks

**Minor (1.0 → 1.1):**
- Add new optional signals
- Relax constraints
- Add/modify terminal nodes

**Major (1.0 → 2.0):**
- Change fundamental structure
- Redefine muscle groups
- Change FSM flow

---

## Performance Considerations

### Optimization Tips
1. **Minimize held_ms**: Shorter holds = faster feedback (but more noisy)
2. **Widen angle ranges**: Tolerance improves completion rate
3. **Parallel paths**: Reduce sequential dependencies
4. **Sync nodes**: Use sparingly (can slow FSM evaluation)

### Typical Numbers
- `hold_ms`: 100-200 (debounce window)
- `range` width: 20-40 degrees
- `min_ms`: 50-100
- `max_ms`: 200-500

---

## Testing

### Manual Testing
1. Load exercise from DB
2. Create mock pose data
3. Feed through validator
4. Check FSM state progression
5. Verify terminal node reached

### Test Checklist
- [ ] All signals calculate without errors
- [ ] Angle ranges are reasonable
- [ ] FSM progresses naturally
- [ ] Terminal nodes are reachable
- [ ] Time constraints are realistic
- [ ] Parallel paths don't deadlock

---

## Future Features

### Planned Enhancements
- [ ] Exercise categories (cardio, strength, flexibility)
- [ ] Intensity levels (easy, normal, hard)
- [ ] Rest period definitions
- [ ] Warm-up sequences
- [ ] Progressive overload tracking
- [ ] Custom scoring weights

### Under Consideration
- [ ] Multi-sided exercise (front/side/back views)
- [ ] Dynamic range adjustment
- [ ] AI-assisted exercise generation
- [ ] Peer exercise sharing

---

## Resources

- [ReadMe](./README.md) - Project overview
- [Roadmap](./ROADMAP.md) - Development timeline
- [MoveNet Keypoints](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) - Keypoint reference
- FSM Validation Engine (TBD)
- Graph Engine (TBD)

---

*Last Updated: January 28, 2026*
