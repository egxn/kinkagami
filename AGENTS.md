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
pnpm configure          # interactive wizard -> apps/embedded/src/config/defaultAppConfig.json
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

## Monorepo layout

pnpm workspace (`pnpm-workspace.yaml`). Root scripts (`pnpm dev`, `pnpm test`, ...) delegate to the right package.

```
apps/embedded/   current app (V1 python / V2 workers / V3 PWA) — offline-first, device/board
apps/web/        online client served by URL (Vite + React Router); downloads models on first visit; local-first
apps/mobile/     reserved for the React Native client (not implemented yet)
packages/core/   @kgm/core — platform-agnostic logic (no DOM, React, TF.js, PouchDB)
packages/ui/     @kgm/ui — presentational React components + design tokens (shared by embedded and web)
backend/         Python WebSocket backend (V1 only)
setup/           repo-level shell scripts (install, configure, run)
```

HTTPS dev: `pnpm certs:dev` (writes git-ignored `.certs/`), `pnpm hosts:add|remove|status`, `pnpm dev:web:https`, `pnpm dev:embedded:https`. Vite options are shared through `setup/dev-https.mjs` (`KGM_DEV_HTTPS`, `KGM_DEV_LAN`). Never commit `.certs/`; never run `hosts:add` for the user — it edits `/etc/hosts` with sudo (test with `HOSTS_FILE=<temp file>`).

Per-case commands: `pnpm dev:embedded:python|frontend|pwa`, `pnpm dev:web`, and matching `build:*`, `preview:*`, `start:*`, `test:*`, `lint:*` (see README "Run each case"). Unqualified names (`pnpm dev`, `pnpm build`) refer to embedded.

`apps/web` shares `@kgm/core` and `@kgm/ui` with embedded but not inference/storage code; it has its own `src/platform/` (PouchDB-browser, localStorage), `src/models/` (first-visit download gate + Cache API, same cache name as its Workbox rule) and `src/pose/`. Offline-first is a requirement for embedded; web is online-first but works offline after the first model download.

### `@kgm/core`

Pose types/geometry, exercise model, session comparator (FSM/grid/tempo/overall scoring), exercise generator, `trainerSession` (rep/exercise/routine state machine), `AppConfig` schema + sanitizer, and the **ports** every client implements: `ExerciseRepository`, `RoutineRepository`, `ConfigStore`, `PoseSource`. ESLint forbids React/TF.js/MediaPipe/PouchDB/i18n imports there, and its tsconfig has no DOM lib. Consumed as TS source (no build step).

Clients bind ports in their own composition root; in embedded that is `apps/embedded/src/platform/` (one module per port: `repositories.ts`, `configStore.ts`). Import the specific module you need so e.g. config code never pulls in PouchDB.

## Code layout (`apps/embedded/src/`)

- `components/` — connected wrappers that inject hooks/context/i18n/services into `@kgm/ui` components (the presentational components themselves live in `packages/ui`)
- `inference/` — inference abstraction layer; `providers/` holds backend-specific implementations (MoveNet, BlazePose, Python). Consumers must go through `usePoseInference()` / `useHandInference()`, never import a provider directly
- `hooks/` — application hooks
- `context/` — React context providers
- `platform/` — adapters binding `@kgm/core` ports to browser implementations (PouchDB, localStorage)
- `services/` — client-side services (e.g. hand detection loop). Pure logic belongs in `packages/core`
- `views/` — page-level views (Trainer, Canvas, Models, Create, Config)
- `types/` — client-only type definitions (shared domain types live in `@kgm/core`)
- `config/` — `defaultAppConfig.json` (real), `testAppConfig.json` (test defaults)
- `db/` — PouchDB service + exercise/routine seed definitions
- `workers/` — Web Worker implementations (MoveNet)
- `tests/` — test suite

## Conventions / invariants to preserve

- **Core stays platform-agnostic**: anything in `packages/core` must run on web, embedded and native. No DOM types, React, TF.js, PouchDB or i18n there; add a port instead.
- **UI/logic split**: `packages/ui` (`@kgm/ui`) stays presentational: React + types + SCSS only. No hooks into app state, context, i18n (`react-i18next`), routing, TF.js or storage (ESLint enforces it). Text arrives through `labels`/props, data through props, behavior through callbacks. Connected wrappers in `apps/embedded/src/components/` inject all of that. Design tokens (`--kgm-*`) live in `@kgm/ui/tokens.css`; each app imports it once.
- **Web models come from a CDN in production**: `apps/web/.env.production` sets `VITE_KGM_MODELS_BASE_URL`; builds do not bundle weights. Keep `pnpm check:models-cdn` passing when moving `apps/embedded/public/models`.
- **Inference abstraction**: never import from `src/inference/providers/` outside `src/inference/`. All consumers use `usePoseInference()` / `useHandInference()`; backend selection is resolved from config via `resolveBackend.ts`.
- **Exercises are data, not code**: exercise definitions are versioned JSON (`signals`, `event_graph`, `completion`, `grid_validation`, optional timing) — the source of truth for validation. Prefer extending the JSON schema over hardcoding exercise-specific logic.
- **Deterministic validation**: Trainer scoring is config-driven (`evaluation.type`: `fsm`, `grid` or `hybrid`), not heuristic/ML-based.
- **Offline-first**: all three targets must work without network after first load. Model assets are served from `public/models`; don't introduce a hard dependency on remote fetches for core flows.
- **PWA caching**: app shell is precached at install; files under `/models/**` are deliberately excluded from precache and cached on first use (`CacheFirst`). Don't change this split without reading ARCHITECTURE.md §10.

## Before submitting changes

- Run `pnpm lint`, `pnpm typecheck` and `pnpm test` (or the `:core` / `:embedded` / `:web` variants for the package you touched).
- If touching build/runtime config, verify all three targets still make sense (`runtime.execution`: `python`/`workers`/`site`).
- `pnpm build` requires Node from `.nvmrc`; PWA commands (`dev:pwa`, `build:pwa`) require Node 22+.
