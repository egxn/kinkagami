# Smart Fitness Mirror - Architecture

This document describes the implemented architecture for the Smart Fitness Mirror project. The current system is optimized for offline execution, deterministic validation, and limited SBC-class hardware.

---

## 1. System Goals

- Run fully offline (no cloud dependency)
- Preserve privacy by keeping data local
- Keep UI responsive on limited hardware
- Use versioned JSON exercise definitions as source of truth
- Separate detection, validation, rendering, and persistence

---

## 2. Runtime Topology

```mermaid
graph TD
  Camera --> InferenceLayer
  InferenceLayer --> SessionComparator
  SessionComparator --> TrainerUI
  SessionComparator --> LocalDB
  LocalDB --> Views
```

Main subsystems:

1. Inference layer (abstracts over browser workers / Python backend)
2. Session comparator (FSM + graph + grid metrics)
3. Trainer flow (score threshold, rep progression, routine progression)
4. Local persistence layer
5. Configuration layer (`/config` + localStorage)

---

## 3. Inference Abstraction Layer

The `src/inference/` module decouples pose/hand detection from the rest of the application. Consumer code never decides which backend to use — the inference layer resolves that from configuration.

```mermaid
graph TD
  Config[AppConfig] --> Resolver[resolveBackend]
  Resolver --> |browser| BrowserProviders
  Resolver --> |python| PythonProvider

  subgraph BrowserProviders
    MoveNet[useMovenet]
    BlazePose[useBlazePose]
    LocalHand[useLocalHandPose]
  end

  subgraph PythonProvider
    PyPose[usePythonPoseEstimator]
    PyHand[usePythonHandEstimator]
    WSClient[pythonBackendClient]
  end

  BrowserProviders --> PoseEstimator
  PythonProvider --> PoseEstimator
  PoseEstimator --> usePoseDetection
```

Entry points:

- `usePoseInference()` — returns a `PoseEstimator` regardless of backend
- `useHandInference()` — returns a `HandEstimator` regardless of backend

Providers live in `src/inference/providers/` and are never imported directly by views or context providers.

---

## 4. UI Library Layer

Pure presentational components live in `src/ui/`. They have no dependencies on hooks, context, or services — only React, types, and SCSS.

Connected wrappers in `src/components/` inject project-specific logic (hooks, context, services) into the UI components.

```
src/ui/          → Pure components (Button, Skeleton, ExerciseCard, etc.)
src/components/  → Connected wrappers (Button + useHandPose, etc.)
```

This separation allows updating the UI independently from project logic.

---

## 5. Main Thread and Worker Strategy

The project supports three runtime execution modes via app config: `workers`, `site`, or `python`.

```mermaid
graph LR
  UI[Main Thread UI] --> PoseLoop
  PoseLoop --> InferenceLayer
  InferenceLayer --> |workers| MoveNetWorker
  InferenceLayer --> |site| MainThreadDetector
  InferenceLayer --> |python| WebSocketBackend
```

Current implementation:

- MoveNet can run in a dedicated worker (worker-first path with fallback)
- BlazePose runs in browser with local MediaPipe runtime (offline assets)
- Python backend provides camera capture + inference via WebSocket
- Rendering and camera stream remain on main thread

---

## 6. Pose and Validation Pipeline

```mermaid
graph TD
  RawPose[Pose keypoints] --> Signals[Signal extraction]
  Signals --> EventGraph[FSM/Event graph]
  Signals --> GridValidation[Grid validation]
  EventGraph --> Snapshot
  GridValidation --> Snapshot
```

`SessionComparator` computes:

- FSM/event-graph progress (`score`, `matchedCount`, `completion`, `completed`)
- Grid progress (`gridScore`, `gridProgress`, matched keypoints)
- Active signals for diagnostics and overlays

Validation behavior in Trainer is config-driven:

- `evaluation.type = fsm`: score from FSM/event-graph metrics
- `evaluation.type = grid`: score from grid metrics

---

## 7. Routine Execution Flow

Trainer loop behavior:

1. Load current routine item exercise
2. Process live pose snapshots continuously
3. Compute score percent according to configured evaluation type
4. Mark a rep complete when score reaches threshold 80
5. Move to next exercise when target reps are completed
6. Show routine complete message when last exercise finishes

This logic is deterministic and state-driven.

---

## 8. Configuration Architecture

Configuration is seeded from `src/config/defaultAppConfig.json` and persisted in localStorage.

Current config domains:

- `models`:
  - `poseModel`: `movenet` | `blazepose`
  - model variants for MoveNet, BlazePose, HandPose
- `camera`:
  - `source`: `web` | `streamUrl`
  - `streamUrl`: MJPEG endpoint URL
- `runtime`:
  - `execution`: `workers` | `site` | `python`
  - `backend`: `webgl` | `wasm`
  - `pythonWebSocketUrl`: WebSocket URL for Python backend
- `evaluation`:
  - `type`: `fsm` | `grid`

Config updates are propagated through a custom window event so active views can react without reload.

The configuration wizard (`pnpm configure`) generates this file interactively.

A separate `src/config/testAppConfig.json` provides browser-friendly defaults (webgl, site execution) for the test suite, loaded automatically in test setup.

---

## 9. Data and Storage

- Exercises and routines are stored locally
- JSON definitions are canonical and can be migrated into DB records
- No client direct DB access from remote devices
- No database files in `/public`

---

## 10. Offline Model Assets

Model assets are served locally from `public/models`.

Highlights:

- MoveNet: local TFJS model URLs
- BlazePose: local MediaPipe assets under `public/models/blazepose/mediapipe`
- HandPose: local detector/landmark model paths

This allows startup and validation without network access.

---

## 11. Project Structure

```
src/
├── inference/           Inference abstraction layer
│   ├── providers/       Backend-specific: useMovenet, useBlazePose, pythonBackendClient
│   ├── usePoseInference.ts    Unified pose detection hook
│   ├── useHandInference.ts    Unified hand detection hook
│   ├── resolveBackend.ts      Config → backend resolver
│   └── types.ts               Shared inference types
├── ui/                  Pure presentational components (no project deps)
├── components/          Connected wrappers (inject hooks/context/services)
├── hooks/               Application hooks (thin delegates for inference)
├── context/             React context providers
├── services/            Business logic (session comparator, hand detection loop)
├── views/               Page-level views (Trainer, Canvas, Models, Create, Config)
├── types/               TypeScript type definitions
├── config/              Default and test app configuration
├── db/                  Database service, exercise/routine seeds
├── workers/             Web Worker implementations (MoveNet)
├── utils/               Utility functions
├── locales/             i18n translation files
└── tests/               Test suite
```

---

## 12. Design Principles

- Local-first and offline-first by default
- Explicit state machines over implicit heuristics
- JSON contracts over hardcoded logic
- Small composable modules
- Performance-aware runtime placement (worker vs main thread)
- UI decoupled from logic via presentational/connected component split
- Inference backend decoupled from consumer code via abstraction layer

---

## 13. Known Extension Points

- Additional scoring modes
- More runtime partitioning into workers
- Advanced routine feedback and post-session analytics
- Exercise authoring UX improvements
- New inference backends (e.g. ONNX, WebGPU)

---

This architecture is intended to evolve incrementally while preserving deterministic behavior and offline operation.
