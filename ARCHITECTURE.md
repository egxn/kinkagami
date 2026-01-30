# 🪞 Smart Fitness Mirror – Architecture

This document describes the high-level architecture of the **Smart Fitness Mirror** system. The focus is on **offline-first**, **deterministic behavior**, and **performance on embedded hardware (Radxa-class SBC)**.

---

## 1. System Goals

- Run fully **offline**
- Respect user **privacy** (no cloud by default)
- Work on **limited hardware**
- Allow **iterative exercise design**
- Separate **logic, rendering, and data**

---

## 2. High-Level Overview

The system is composed of five main layers:

1. Pose Inference
2. Validation Engine (FSM + Graphs)
3. Rendering Engine
4. Local API
5. Local Storage

```mermaid
graph TD
  Camera --> PoseModel
  PoseModel --> Worker
  Worker -->|Validation State| Renderer
  Worker -->|Events| LocalAPI
  LocalAPI --> MobileUI
  LocalAPI --> LocalDB
```

---

## 3. Runtime Architecture

### 3.1 Main Thread vs Workers

The main UI thread is kept lightweight. Heavy computation runs in Web Workers.

```mermaid
graph LR
  MainThread[Main Thread]
  Worker[Worker Thread]

  MainThread -->|Pose Frames| Worker
  Worker -->|Draw Instructions| MainThread
  Worker -->|State Updates| MainThread
```

**Main Thread responsibilities:**

- Canvas rendering
- UI state
- Camera capture
- Network I/O

**Worker responsibilities:**

- Pose normalization
- FSM execution
- Graph traversal
- Temporal constraint validation
- Scoring

---

## 4. Pose Processing Pipeline

```mermaid
graph TD
  RawPose[Raw Pose Keypoints]
  NormalizedPose[Normalized Pose]
  AngleCalc[Angle Computation]
  FSM[FSM + Graph Engine]
  State[Exercise State]

  RawPose --> NormalizedPose
  NormalizedPose --> AngleCalc
  AngleCalc --> FSM
  FSM --> State
```

Key characteristics:

- Deterministic
- Time-aware
- Noise-tolerant

---

## 5. Exercise Model

Exercises are defined as **versioned JSON graphs**.

```mermaid
graph TD
  Step1[Angle Step A]
  Step2[Angle Step B]
  Step3[Angle Step C]

  Step1 --> Step2
  Step1 --> Step3
  Step2 --> Step3
```

Each exercise defines:

- Moving points / angles
- Expected min/max sequences
- Parallel paths
- Temporal constraints

JSON is the **source of truth**.

---

## 6. Validation Engine (FSM + Graphs)

Each exercise run is evaluated by a **Finite State Machine** enhanced with **directed graphs**.

```mermaid
graph LR
  Idle --> InProgress
  InProgress --> Failed
  InProgress --> Completed
  Failed --> Idle
```

FSM state is enriched with:

- Current graph nodes
- Time windows
- Partial completion

---

## 7. Rendering Architecture

Rendering uses **Canvas 2D** with layered drawing passes.

```mermaid
graph TD
  Ghost[Ghost Pose]
  User[User Pose]
  Feedback[Feedback Overlay]

  Ghost --> Canvas
  User --> Canvas
  Feedback --> Canvas
```

Rendering uses **draw instructions**, not raw logic.

---

## 8. Control & Interaction

The mirror has **no touchscreen**.

Control is provided via:

- QR code
- Local web UI (mobile)
- Optional gestures or hardware buttons

```mermaid
graph TD
  Mobile[Mobile Browser]
  API[Local API]
  FSMEngine[FSM Engine]

  Mobile -->|Commands| API
  API --> FSMEngine
```

---

## 9. Data & Storage

All data is stored locally.

```mermaid
graph TD
  JSON[Exercise JSON]
  Migration[Migration Layer]
  DB[(Local DB)]

  JSON --> Migration
  Migration --> DB
```

Stored data includes:

- Exercises
- Tutor exercises
- Execution runs
- Metrics

The database is **never exposed directly**.

---

## 10. Design Principles Summary

- JSON as contracts
- FSMs over heuristics
- Graphs for parallelism
- Workers for performance
- Canvas for efficiency
- Local-first always

---

## 11. Future Extensions

- Optional DTW-based scoring
- Tutor recording mode
- Exercise editor UI
- Multi-camera support

---

🪞 _This architecture is designed to evolve without breaking core assumptions._
