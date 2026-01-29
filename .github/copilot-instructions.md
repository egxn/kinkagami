# Copilot Instructions – Smart Fitness Mirror

This repository contains the software for a **smart fitness mirror** running on an embedded board (Radxa-class SBC).

Copilot should follow these principles when generating code, suggestions, or refactors.

---

## 1. Project Context

This project includes:

- Real-time **human pose detection**
- Exercise validation using:
  - Finite State Machines (FSM)
  - Directed graphs
  - Temporal constraints
  - Angle-based rules
- A **ghost vs user** visualization system
- Offline-first architecture
- Local-only data storage (no cloud by default)

The system runs on **limited hardware**, so performance and simplicity matter.

---

## 2. Architectural Principles

Copilot should assume:

- **Client-side / local-first**
- No external servers required
- Exercises are defined as **versioned JSON schemas**
- JSON is the *source of truth*
- Databases are used only for runtime queries and persistence

Avoid:
- Heavy abstractions
- Over-engineered patterns
- Unnecessary frameworks

---

## 3. Rendering Guidelines

- Prefer **Canvas 2D** over WebGL / Three.js
- Rendering should be **decoupled** from validation logic
- Visualization uses:
  - Skeleton lines
  - Keypoints
  - Angles
  - Simple overlays

Avoid:
- Full 3D avatars unless explicitly requested
- GPU-heavy solutions

---

## 4. Performance Constraints

The target hardware is a **Radxa SBC**.

Therefore:
- Prefer lightweight algorithms
- Avoid multiple ML models running in parallel
- Use **Web Workers** whenever possible for:
  - Pose processing
  - FSM / graph evaluation
  - Scoring
  - Temporal validation

The main thread should stay responsive and focused on UI.

---

## 5. Pose & Gesture Logic

- Prefer reusing **existing pose keypoints**
- Gestures should be:
  - Rule-based
  - Time-constrained
  - Debounced
- Avoid adding a separate hand-tracking model unless strictly necessary

---

## 6. Data & Storage

- Databases must NOT be placed in `/public`
- Use local storage solutions such as:
  - SQLite
  - IndexedDB
  - PouchDB
- Access data through a local API layer

Exercise definitions:
- Live in JSON files
- Are versioned
- Can be migrated into the local DB

---

## 7. Networking & Control

- The mirror is controlled via:
  - Local web interface
  - QR code access
  - Wi-Fi (preferred over Bluetooth)
- Mobile devices interact via HTTP/WebSocket
- No direct DB access from clients

---

## 8. Coding Style Preferences

- Prefer **clear and readable code**
- Avoid overly clever solutions
- Small, composable functions
- Explicit state machines over implicit logic
- Comments are welcome when logic is non-trivial

When in doubt:
> choose clarity and robustness over abstraction.

---

## 9. What Copilot Should NOT Assume

- No cloud connectivity
- No touch screen
- No powerful GPU
- No unlimited memory
- No need for enterprise-scale solutions

---

## 10. Goal

The goal is to build a **robust, offline, privacy-respecting fitness mirror** with:

- Clear feedback
- Deterministic behavior
- Easy-to-evolve exercise definitions
- Strong separation between logic, rendering, and data
