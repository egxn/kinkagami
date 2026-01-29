# 🪞 Smart Fitness Mirror

A **local-first, offline smart fitness mirror** designed to run on **embedded hardware and low-power systems** (e.g. SBCs, mini PCs, or similar platforms).
The system detects, validates, and visualizes physical exercises in real time using **pose estimation**, **finite state machines**, and **graph-based rules**.

This project prioritizes:

* 🧠 Deterministic behavior
* 🔒 Privacy (no cloud by default)
* ⚡ Performance on limited hardware
* 🧩 Evolvable exercise definitions

---

## ✨ What This Project Does

The mirror:

* Captures the user’s body pose via camera
* Compares it against an **ideal exercise definition** ("ghost")
* Validates whether the exercise was performed correctly
* Provides **real-time visual feedback**
* Stores results **locally**
* Can be controlled from a **mobile phone via QR code**

No touchscreen. No cloud. No heavy GPU requirements.

---

## 🧱 High-Level Architecture

The system is composed of five main layers:

1. Pose Inference
2. Validation Engine (FSM + Graphs)
3. Rendering Engine (Canvas 2D)
4. Local API
5. Local Storage

> A full architectural breakdown with diagrams is available in [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 🧠 How Exercise Detection Works

Exercise validation is **rule-based and deterministic**, not heuristic or black-box.

### Core Idea

An exercise is considered **completed** if:

1. **Expected angles reach defined ranges** (min / max)
2. **Those ranges occur in the correct temporal order**
3. **Multiple angles can progress in parallel**
4. **Time relationships between angles are respected**
5. **All constraints converge to a valid final state**

This is implemented using:

* Finite State Machines (FSM)
* Directed graphs
* Temporal constraints

---

## 🔁 Pose Processing Pipeline

1. Camera captures frames
2. Pose model extracts body keypoints
3. Keypoints are normalized
4. Joint angles are calculated
5. Angles are fed into the validation engine

This pipeline runs continuously during an exercise.

---

## 🧩 Exercise Definition Model

Exercises are defined as **versioned JSON files**.

Each exercise specifies:

* Which joints / angles are involved
* Expected angle ranges
* The sequence of movements
* Parallel steps
* Temporal constraints between steps


### Example (simplified)

<details>
<summary>Click to expand</summary>

```json
{
  "exercise_id": "squat_with_arm_raise",
  "name": "...",
  "description": "...",
  "muscle_groups": ["...", "...", "...", "..."],
  "difficulty": "intermedio",
  "instructions": [
    "...",
  ],
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
  },
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
        "id": "hip_flexed",
        "signal": "hip_angle",
        "range": [70, 95],
        "hold_ms": 150,
        "emit": true
      },
      {
        "id": "bottom_reached",
        "type": "sync",
        "requires": ["knee_flexed", "hip_flexed"]
      },
      {
        "id": "arms_raised",
        "signal": "shoulder_angle",
        "range": [140, 180],
        "hold_ms": 120,
        "emit": true
      },
      {
        "id": "knee_extended",
        "signal": "knee_angle",
        "range": [160, 180],
        "hold_ms": 150
      },
      {
        "id": "hip_extended",
        "signal": "hip_angle",
        "range": [160, 180],
        "hold_ms": 150
      }
    ],
    "edges": [
      { "from": "knee_flexed", "to": "bottom_reached" },
      { "from": "hip_flexed", "to": "bottom_reached" },
      { "from": "bottom_reached", "to": "arms_raised" },
      { "from": "arms_raised", "to": "knee_extended" },
      { "from": "arms_raised", "to": "hip_extended" }
    ]
  },
  "time_constraints": [
    {
      "id": "arms_after_bottom",
      "from": "bottom_reached",
      "to": "arms_raised",
      "min_ms": 50,
      "max_ms": 200,
      "severity": "soft"
    }
  ],
  "completion": {
    "terminal_nodes": ["knee_extended", "hip_extended"]
  }
}
```

</details>

JSON files are the **source of truth** and can be migrated into the local database.

---

## 🔀 Parallel Movements & Graphs

Many exercises involve **simultaneous joint movements**.

Instead of a linear sequence, each angle is modeled as a **directed graph**:

* Nodes represent valid angle states
* Edges represent allowed transitions
* Multiple graphs run in parallel

The exercise progresses only if all required paths advance coherently.

---

## ⏱ Temporal Constraints

Exercises often require **timing relationships** between joints.

Examples:

* Knee bend must occur within 300 ms of hip bend
* Arms must reach extension after torso stabilization

Each constraint defines:

* Source step
* Target step
* Allowed time window

Multiple constraints can be active simultaneously.

---

## 🔄 Finite State Machine (FSM)

Each exercise execution is governed by an FSM:

* `IDLE`
* `IN_PROGRESS`
* `FAILED`
* `COMPLETED`

The FSM:

* Tracks current graph nodes
* Validates constraints
* Handles resets on divergence

This guarantees **predictable behavior** and clear outcomes.

---

## 🎨 Visualization (Ghost vs User)

The mirror displays:

* A **ghost pose** (ideal execution)
* The **user’s real-time pose**
* Visual feedback layers (angles, warnings, success)

Rendering is done using **Canvas 2D** for performance and simplicity.

All rendering is driven by **draw instructions**, not business logic.

---

## 📱 Control & Interaction

The mirror has **no touchscreen**.

Control options:

* QR code displayed on the mirror
* Mobile web interface (local network)
* Optional basic gestures or physical button

The mobile UI communicates with the mirror via a **local HTTP / WebSocket API**.

---

## 💾 Data & Storage

All data is stored **locally**.

Stored data includes:

* Exercises (imported from JSON)
* Tutor-defined exercises
* Exercise runs
* Scores and metrics

The database:

* Is never placed in `/public`
* Is never accessed directly by clients

---

## ⚙️ Performance Strategy

Target hardware: **embedded or low-power systems** (SBCs, mini PCs, or equivalent).

To ensure smooth performance across different hardware vendors:

* Heavy logic runs in **Web Workers**
* Rendering stays on the main thread
* Only one ML model runs at a time
* Hardware-specific optimizations are isolated
* No cloud dependencies

---

## 🧪 Extensibility

Planned / possible extensions:

* DTW-based scoring (optional)
* Tutor recording mode
* Visual exercise editor
* Multi-user profiles
* Multi-camera setups

---

## 🧭 Design Philosophy

* JSON as contracts
* FSMs over heuristics
* Graphs over linear scripts
* Explicit rules over black-box AI
* Offline-first always

---

## 🚀 Status

This project is under active development and experimentation.

Expect iteration, refinement, and evolution of the exercise model.

---

🪞 *Built as a research-driven, privacy-respecting alternative to cloud-dependent fitness platforms.*
