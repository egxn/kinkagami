# Smart Fitness Mirror

Local-first, offline fitness mirror for embedded and low-power hardware. Also distributable as an installable PWA for mobile and desktop.

The system detects poses in real time, validates movement quality with deterministic rules, and renders ghost-vs-user feedback directly in the browser.

---

## Deployment Targets

Three distinct build targets share the same codebase:

| Target | Inference | Camera | Use case |
|---|---|---|---|
| **V1 — Python** | Python backend via WebSocket | Hardware (MJPEG/stream) | Dedicated hardware mirror with specialized camera |
| **V2 — WASM/WebGL** | Browser workers (TF.js) | Hardware (MJPEG/stream) | Standalone kiosk without Python dependency |
| **V3 — PWA** | Browser workers (TF.js) | Device camera (getUserMedia) | Installable web app for mobile and desktop |

All three use the same inference abstraction layer. The active backend is selected by `runtime.execution` in app config, set at build time via environment variables.

---

## Quick Start

### 1. Install everything

```bash
pnpm setup
```

This installs frontend dependencies (pnpm), backend dependencies (poetry), and runs database migrations.

### 2. Configure

```bash
pnpm configure
```

Interactive wizard that generates `src/config/defaultAppConfig.json` with your preferred pose model, camera source, runtime mode, and evaluation type.

### 3. Run (development)

```bash
# V1 — Python backend (camera + inference via WebSocket)
pnpm dev:python

# V2 — Browser-only inference (workers)
pnpm dev:frontend

# V3 — PWA (device camera, browser inference, service worker)
pnpm dev:pwa

# Plain Vite dev server
pnpm dev
```

> **Note:** `dev:pwa` and `build:pwa` require Node.js 22+. Use `nvm use 22` if needed (`.nvmrc` is included).

### 4. Run (production)

```bash
# V1/V2 — Build and serve
pnpm start

# V1 — With Python backend
pnpm start:python

# V3 — PWA build (outputs dist/ ready for static hosting)
pnpm build:pwa
```

---

## Available Scripts

| Command | Purpose |
|---|---|
| `pnpm setup` | Install pnpm + poetry deps, run DB migrations |
| `pnpm configure` | Interactive configuration wizard |
| `pnpm dev` | Vite dev server |
| `pnpm dev:frontend` | Dev with browser-only inference (V2) |
| `pnpm dev:python` | Dev with Python backend + Vite (V1) |
| `pnpm dev:pwa` | Dev with PWA mode (V3) |
| `pnpm dev:videos` | Dev with local video server |
| `pnpm dev:stream` | Dev with MJPEG stream |
| `pnpm build` | TypeScript check + Vite build (V1/V2) |
| `pnpm build:pwa` | Vite PWA build — outputs service worker + manifest (V3) |
| `pnpm preview:pwa` | Serve existing PWA build locally |
| `pnpm start` | Build + preview (production) |
| `pnpm start:python` | Production with Python backend |
| `pnpm preview` | Serve existing build |
| `pnpm pwa:icons` | Regenerate PWA icons from `public/icons/kinkagami-source.svg` |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm db:migrate` | Load seed data into local DB |
| `pnpm db:seeds:generate` | Export current DB to seed files |
| `pnpm kiosk` | Launch Chromium in kiosk mode |

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
- Python backend path:
  - Camera capture + inference via WebSocket

See full design details in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Configuration (`/config`)

App behavior is configurable and persisted in localStorage.

Config domains:

- `models`
  - `poseModel`: `movenet` or `blazepose`
  - model variants for MoveNet, BlazePose, HandPose
- `camera`
  - `source`: `web` or `streamUrl`
  - `streamUrl`: MJPEG URL used when source is `streamUrl`
- `runtime`
  - `execution`: `workers`, `site`, or `python`
  - `backend`: `webgl` or `wasm`
  - `pythonWebSocketUrl`: WebSocket URL for Python backend
- `evaluation`
  - `type`: `fsm` or `grid`

A separate test config (`src/config/testAppConfig.json`) provides browser-friendly defaults for the test suite.

The active evaluation mode controls how the Trainer score is computed.

---

## Project Structure

```
src/
├── ui/              Pure presentational components (no project logic)
├── components/      Connected wrappers (inject hooks/context into UI)
├── inference/       Inference abstraction layer
│   ├── providers/   Backend-specific implementations (MoveNet, BlazePose, Python)
│   ├── usePoseInference.ts
│   └── useHandInference.ts
├── hooks/           Application hooks
├── context/         React context providers
├── services/        Business logic services
├── views/           Page-level views
├── types/           TypeScript type definitions
├── config/          App and test configuration
├── db/              Database service and seed definitions
└── tests/           Test suite
```

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

**PWA (V3) caching strategy:**

- App shell (JS, CSS, HTML, WASM) is precached by the service worker at install time
- ML model files under `/models/` are excluded from precache and cached on first use (`CacheFirst`, 1-year TTL)
- After the first visit (including first inference run), the app works fully offline without any server

---

## Seeds and Board Migration

Generate portable seed files from local PouchDB and load them back.

```bash
# Generate seeds from current local DB
pnpm db:seeds:generate

# Load seeds into local DB
pnpm db:migrate

# Reset local DB before loading seeds
KGM_SEEDS_RESET=1 pnpm db:migrate
```

Generated seed outputs:

- exercises: `src/db/exercises`
- routines: `src/db/routines`
- manifest: `setup/seeds/manifest.json`

Board workflow:

1. Build and generate seeds on your development PC.
2. Move the build output and project seed JSON files to the board.
3. On first run with empty local DB, the app bootstraps exercises and routines from those seed files.

---

## PWA Deployment (V3)

Build and deploy to any static host (Netlify, Vercel, Nginx, S3, etc.):

```bash
nvm use 22
pnpm build:pwa
# upload dist/ to your static host
```

The output in `dist/` is self-contained:

- `sw.js` — Workbox service worker (handles offline caching)
- `manifest.webmanifest` — PWA manifest (enables install prompt)
- `registerSW.js` — Auto-registration script (injected into `index.html`)
- `workbox-*.js` — Workbox runtime

Users visiting the URL for the first time will be prompted to install the app. On subsequent visits (including offline), the app loads entirely from cache.

To regenerate PWA icons from a new source image:

```bash
# Replace public/icons/kinkagami-source.svg with your image, then:
pnpm pwa:icons
```

---

## Design Principles

- Offline-first across all three targets
- Deterministic validation
- Clear separation of concerns
- Lightweight runtime choices for SBC constraints
- JSON contracts over hardcoded exercise logic
- Inference backend decoupled from consumer code — adding new targets requires no changes to consumers
