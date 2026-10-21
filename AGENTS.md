# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Smart Fitness Mirror ("kinkagami"): a local-first, offline fitness mirror. Detects poses in real time, validates movement quality with deterministic rules, and renders ghost-vs-user feedback in the browser. Single codebase, three deployment targets:

| Target | `runtime.execution` | Inference | Camera |
|---|---|---|---|
| V1 — Python | `python` | Python WebSocket backend | Hardware (MJPEG/stream) |
| V2 — WASM/WebGL | `workers` | TF.js browser workers | Hardware (MJPEG/stream) |
| V3 — PWA | `site` | TF.js browser workers | Device camera (`getUserMedia`) |

Target selection is build-time (`VITE_KGM_RUNTIME_EXECUTION`), not a runtime branch in consumer code — the inference abstraction layer hides the difference.

See `README.md` for setup/usage and `ARCHITECTURE.md` for full design details (diagrams, config schema, pipeline). Read `ARCHITECTURE.md` before making structural changes.

## Stack

- Frontend: React 19 + TypeScript, Vite 7, SCSS
- Pose/hand inference: TensorFlow.js (MoveNet, BlazePose via MediaPipe, HandPose)
- Local persistence: PouchDB (IndexedDB in browser, LevelDB in Node)
- Backend (V1 only): Python (Poetry), WebSocket camera/inference server in `backend/`
- PWA: `vite-plugin-pwa` / Workbox (requires Node.js 22+, pinned in `.nvmrc`)
- Package manager: pnpm
- Tests: Vitest
- Lint/format: ESLint, Prettier

## Common commands

```bash
pnpm setup              # install JS + Python deps, run db migrations
pnpm configure          # interactive wizard -> src/config/defaultAppConfig.json
pnpm dev                # plain Vite dev server
pnpm dev:frontend       # V2, browser-only inference
pnpm dev:python         # V1, Python backend + Vite
pnpm dev:pwa            # V3, PWA mode (needs Node 22+, nvm use 22)
pnpm build              # tsc -b && vite build (V1/V2)
pnpm build:pwa          # PWA build -> dist/ with sw.js + manifest
pnpm test               # vitest run
pnpm lint               # eslint .
pnpm format             # prettier --write .
pnpm db:migrate         # load seed data into local db
pnpm db:seeds:generate  # export current db to seed files
```

## Code layout (`src/`)

- `ui/` — pure presentational components, no project logic (no hooks/context/services imports)
- `components/` — connected wrappers that inject hooks/context/services into `ui/` components
- `inference/` — inference abstraction layer; `providers/` holds backend-specific implementations (MoveNet, BlazePose, Python). Consumers must go through `usePoseInference()` / `useHandInference()`, never import a provider directly
- `hooks/` — application hooks
- `context/` — React context providers
- `services/` — business logic (e.g. session comparator, hand detection loop)
- `views/` — page-level views (Trainer, Canvas, Models, Create, Config)
- `types/` — TypeScript type definitions
- `config/` — `defaultAppConfig.json` (real), `testAppConfig.json` (test defaults)
- `db/` — PouchDB service + exercise/routine seed definitions
- `workers/` — Web Worker implementations (MoveNet)
- `tests/` — test suite

## Conventions / invariants to preserve

- **UI/logic split**: `src/ui/` stays free of hooks, context, and service imports — only React, types, SCSS. Project logic goes through `src/components/`.
- **Inference abstraction**: never import from `src/inference/providers/` outside `src/inference/`. All consumers use `usePoseInference()` / `useHandInference()`; backend selection is resolved from config via `resolveBackend.ts`.
- **Exercises are data, not code**: exercise definitions are versioned JSON (`signals`, `event_graph`, `completion`, `grid_validation`, optional timing) — the source of truth for validation. Prefer extending the JSON schema over hardcoding exercise-specific logic.
- **Deterministic validation**: Trainer scoring is config-driven (`evaluation.type`: `fsm` or `grid`), not heuristic/ML-based.
- **Offline-first**: all three targets must work without network after first load. Model assets are served from `public/models`; don't introduce a hard dependency on remote fetches for core flows.
- **PWA caching**: app shell is precached at install; files under `/models/**` are deliberately excluded from precache and cached on first use (`CacheFirst`). Don't change this split without reading ARCHITECTURE.md §10.

## Before submitting changes

- Run `pnpm lint` and `pnpm test`.
- If touching build/runtime config, verify all three targets still make sense (`runtime.execution`: `python`/`workers`/`site`).
- `pnpm build` requires Node from `.nvmrc`; PWA commands (`dev:pwa`, `build:pwa`) require Node 22+.
