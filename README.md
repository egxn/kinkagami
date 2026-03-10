# Smart Fitness Mirror

Local-first, offline fitness mirror for embedded and low-power hardware.

The system detects poses in real time, validates movement quality with deterministic rules, and renders ghost-vs-user feedback directly in the browser.

---

## What It Does

- Captures body pose from camera
- Runs live comparison against exercise definitions
- Evaluates progress using FSM or grid validation
- Counts repetitions and advances routine steps automatically
- Stores exercises/routines locally

No cloud dependency is required for core operation.

---

## Current Runtime Model

- Main thread:
  - UI rendering
  - camera stream
  - overlay composition
- Worker-capable paths:
  - MoveNet inference (worker-first, with fallback)
  - session comparator runtime mode can run in `workers` or `site`
- Browser-local path:
  - BlazePose runs with local MediaPipe assets (offline)

See full design details in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Configuration (`/config`)

App behavior is configurable and persisted in localStorage.

Config domains:

- `models`
  - `poseModel`: `movenet` or `blazepose`
  - model variants for MoveNet, BlazePose, HandPose
- `camera`
  - `flow`: `web` or `streamUrl`
  - `streamUrl`: MJPEG URL used when flow is `streamUrl` (example: `http://localhost:8090/?action=stream`)
- `runtime`
  - `execution`: `workers` or `site`
- `evaluation`
  - `type`: `fsm` or `grid`

The active evaluation mode controls how the Trainer score is computed.

---

## Trainer Flow

Current Trainer behavior:

1. Load selected routine and exercise item
2. Compute score continuously (based on `evaluation.type`)
3. Mark rep complete when score reaches threshold `80`
4. Continue until target reps are completed
5. Auto-advance to next exercise in routine
6. Show routine complete message at the end

---

## Exercise Validation Model

Exercises are versioned JSON definitions and remain the source of truth.

Each definition may include:

- `signals` (angle/distance/relative position)
- `event_graph` (FSM-like progression)
- `completion` terminal nodes
- `grid_validation` sequence rules
- optional timing constraints

This model supports deterministic validation and easy iteration.

---

## Offline Assets and Storage

- Model files are served from `public/models`
- BlazePose MediaPipe files live in `public/models/blazepose/mediapipe`
- Data is persisted locally (exercise/routine/session records)
- Database files are not exposed in `public`

---

## Development

Install dependencies:

```bash
pnpm install
```

Run dev server:

```bash
pnpm dev
```

Run tests:

```bash
pnpm test
```

---

## Seeds And Board Migration

You can now generate portable seed files from local PouchDB and load them back.

Generate seeds from current local DB:

```bash
pnpm run db:seeds:generate
```

Load seeds into local DB:

```bash
pnpm run db:seeds:load
```

Reset local DB before loading seeds:

```bash
KGM_SEEDS_RESET=1 pnpm run db:seeds:load
```

Generated seed outputs:

- exercises: src/db/exercises
- routines: src/db/routines
- manifest: setup/seeds/manifest.json

Board workflow:

1. Build and generate seeds on your development PC.
2. Move the build output and project seed JSON files to the board.
3. On first run with empty local DB, the app bootstraps exercises and routines from those seed files.

---

## Design Principles

- Offline-first
- Deterministic validation
- Clear separation of concerns
- Lightweight runtime choices for SBC constraints
- JSON contracts over hardcoded exercise logic
