# Copilot Instructions – Smart Fitness Mirror

Offline, privacy-respecting fitness mirror running on a **Radxa-class SBC**. See [ARCHITECTURE.md](../ARCHITECTURE.md) for full system design.

---

## Build & Test

```bash
pnpm install                # install frontend deps
pnpm setup                  # install all deps + migrate DB
pnpm configure              # interactive config wizard (generates src/config/defaultAppConfig.json)
pnpm dev                    # Vite dev server
pnpm dev:frontend           # dev with Python backend
pnpm build                  # tsc + vite build
pnpm test                   # vitest run (jsdom, src/tests/**/*.test.{ts,tsx})
pnpm lint                   # eslint
pnpm db:migrate             # seed PouchDB from src/db/exercises/*.json
pnpm kiosk                  # launch Chromium in kiosk mode
```

Tests use `src/tests/setup.ts` which loads `src/config/testAppConfig.json` (forces `webgl` + `site` execution mode — safe for browser-less CI).

---

## Architecture

The system is split into five clean layers. Never mix them:

| Layer | Path | Rule |
|---|---|---|
| Inference | `src/inference/` | Abstracts all pose/hand backends. Only entry points: `usePoseInference()`, `useHandInference()`. Never import providers directly. |
| UI | `src/ui/` | Pure presentational — React, SCSS, `src/types/`, rendering utils only. No hooks, context, services, or db imports. |
| Connected | `src/components/` | Wraps `src/ui/` with hooks/context. Views import from here, not `src/ui/`. |
| Services | `src/services/` | Business logic: session comparator, hand detection loop. No React. |
| DB | `src/db/` | PouchDB access only. Never place DB files in `/public`. Access only through `dbService.ts`. |

---

## Key Conventions

**Exercises**
- Definitions live in `src/db/exercises/*.json` (not `public/`), loaded at runtime via PouchDB.
- To add a new exercise, update the `EXERCISE_FILES` registry in `src/db/exercises/index.ts`.
- On first `getAllExercises()` call, the DB auto-seeds from JSON if empty — this is intentional.

**Configuration**
- Source of truth: `src/config/defaultAppConfig.json`, persisted in `localStorage`.
- Config domains: `models`, `camera`, `runtime` (`workers` | `site` | `python`), `evaluation` (`fsm` | `grid`).
- Config changes propagate via a custom `window` event — no page reload needed.

**Rendering**
- Prefer Canvas 2D. No WebGL / Three.js / 3D avatars unless explicitly requested.
- Rendering is always decoupled from validation logic.

**Workers**
- Offload to Web Workers: pose processing, FSM evaluation, scoring, temporal validation.
- Main thread: UI rendering and camera stream only.

**Gestures / hand pose**
- Rule-based, time-constrained, debounced.
- Reuse existing pose keypoints. Do not add a second hand-tracking model.

---

## Hardware Constraints

Target: Radxa SBC. Assume:
- No GPU, no touch screen, no cloud, no unlimited memory.
- Single ML model at a time.
- Lightweight algorithms only.

---

## Style

- Clarity over cleverness. Small composable functions. Explicit FSMs over implicit heuristics.
- Comments on non-trivial logic are welcome.
- No enterprise-scale abstractions or unnecessary frameworks.
