# Smart Fitness Mirror

Local-first, offline fitness mirror for embedded and low-power hardware. Also distributable as an installable PWA for mobile and desktop.

The system detects poses in real time, validates movement quality with deterministic rules, and renders ghost-vs-user feedback directly in the browser.

> **Status:** progress and priorities are tracked in [PROGRESS.md](PROGRESS.md).

## Getting Started

### 1. Install everything

```bash
pnpm setup
```

This installs frontend dependencies (pnpm), backend dependencies (poetry), and runs database migrations.

### 2. Configure

```bash
pnpm configure
```

Interactive wizard that generates `apps/embedded/src/config/defaultAppConfig.json` with your preferred pose model, camera source, runtime mode, and evaluation type.

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

## Usage

### Run each case

One command per client/target. The unqualified names (`pnpm dev`, `pnpm build`, `pnpm start`, `pnpm dev:python`, ...) still work and refer to the embedded app.

| Case | Dev | Build | Serve build | Build + serve |
|---|---|---|---|---|
| **Embedded — Python backend (V1)** | `pnpm dev:embedded:python` | `pnpm build:embedded` | `pnpm preview:embedded` | `pnpm start:embedded:python` |
| **Embedded — browser inference (V2)** | `pnpm dev:embedded:frontend` | `pnpm build:embedded` | `pnpm preview:embedded` | `pnpm start:embedded` |
| **Embedded — PWA (V3)** | `pnpm dev:embedded:pwa` | `pnpm build:embedded:pwa` | `pnpm preview:embedded:pwa` | `pnpm start:embedded:pwa` |
| **Web (online)** | `pnpm dev:web` (`:5174`) | `pnpm build:web` | `pnpm preview:web` (`:4174`) | `pnpm start:web` |
| Web, models from CDN | `pnpm dev:web:cdn` | `pnpm build:web` (always CDN) | `pnpm preview:web` | `pnpm start:web` |
| Web / Embedded over **HTTPS** | `pnpm dev:web:https`, `pnpm dev:embedded:https` | — | `pnpm preview:web:https`, `pnpm preview:embedded:https` | — |
| Mobile | _reserved (`apps/mobile`)_ | | | |

Tests and lint per package: `pnpm test:core` / `test:embedded` / `test:web`, `pnpm lint:core` / `lint:embedded` / `lint:web` / `lint:ui`. `pnpm test`, `pnpm lint` and `pnpm typecheck` run every package.

The web app (`apps/web`) is a separate Vite + React Router client served by URL. On first visit it shows a "downloading model" screen and stores the MoveNet weights in the browser cache (also used by its service worker), so later visits start offline. Exercises and routines are stored locally (PouchDB/IndexedDB) and imported from JSON files. **HTTPS in development.** Camera access and PWAs need a secure context. `localhost` already counts as one, but you need real HTTPS for custom hostnames or to test from a phone:

```bash
pnpm certs:dev          # create .certs/ (git-ignored) with mkcert, or openssl + a private local CA
pnpm hosts:add          # map embedded.kinkagami.test and web.kinkagami.test to 127.0.0.1 (asks for sudo)
pnpm dev:web:https      # https://web.kinkagami.test:5174   (also https://localhost:5174)
pnpm dev:embedded:https # https://embedded.kinkagami.test:5173
```

- With `mkcert` installed the script uses it (run `mkcert -install` once). Without it, the script builds its own CA and prints how to trust `.certs/kinkagami-dev-ca.pem` once in your OS/browser.
- Any dev command honors `KGM_DEV_HTTPS=1` (e.g. `KGM_DEV_HTTPS=1 pnpm dev:embedded:python`). `KGM_DEV_LAN=1` also listens on your LAN; regenerate the certificate with `pnpm certs:dev -- --force --ip <your-LAN-IP>` for phone testing.
- `pnpm hosts:status` / `pnpm hosts:remove` inspect and undo the hosts entries (a marked block in `/etc/hosts`; `bash setup/dev-hosts.sh add --dry-run` previews it). On Windows edit `C:\Windows\System32\drivers\etc\hosts` (or run the script from WSL with `HOSTS_FILE=/mnt/c/...` in an elevated shell).
- Vite skips its host-header check when HTTPS is on: the certificate only covers the names above, so TLS provides that protection.
- The embedded app's `ws://127.0.0.1` Python backend and `http://localhost` MJPEG stream still work from an HTTPS page (loopback is treated as secure by browsers); a LAN IP for them would be blocked as mixed content.

**Moving data from embedded to web.** In the embedded app go to Config → Datos → "Exportar ejercicios y rutinas (JSON)", then import that file in the web app (Rutinas → choose file). In dev the web app can also copy embedded's on-disk data automatically (see below).

**Models from a CDN.** Production builds of the web app do not bundle model weights: `apps/web/.env.production` sets `VITE_KGM_MODELS_BASE_URL` to a jsDelivr URL that serves them straight from this GitHub repo (`apps/embedded/public/models`), so `dist/` stays ~2 MB. Pin a tag/commit in that URL for immutable releases, and run `pnpm check:models-cdn` to verify every file is reachable with CORS before deploying. In dev the weights are served locally from the embedded app (use `pnpm dev:web:cdn` to test the CDN path).

**Dev data sync.** In `pnpm dev:web` the web app copies the embedded app's data into its own IndexedDB on first load when it is empty (and via the "Copiar datos de embedded (dev)" button). Sources, read from disk by the dev server at `/__kgm/embedded-data`: the embedded LevelDB (`pnpm db:migrate`) and seed JSON in `apps/embedded/src/db/{exercises,routines}/`. Data you create inside the embedded app in a browser lives in that browser's IndexedDB and cannot be read from another origin.

### Available Scripts

| Command | Purpose |
|---|---|
| `pnpm setup` | Install pnpm + poetry deps, run DB migrations |
| `pnpm configure` | Interactive configuration wizard (embedded) |
| `pnpm dev` | Embedded dev server (alias of `dev:embedded`) |
| `pnpm dev:frontend` | Alias of `dev:embedded:frontend` (V2) |
| `pnpm dev:python` | Alias of `dev:embedded:python` (V1) |
| `pnpm dev:pwa` | Alias of `dev:embedded:pwa` (V3) |
| `pnpm dev:videos` | Dev with local video server |
| `pnpm dev:stream` | Dev with MJPEG stream |
| `pnpm build` | TypeScript check + Vite build of embedded (V1/V2) |
| `pnpm build:pwa` | Alias of `build:embedded:pwa` (V3) |
| `pnpm preview:pwa` | Alias of `preview:embedded:pwa` |
| `pnpm start` | Embedded build + preview (production) |
| `pnpm start:python` | Production with Python backend |
| `pnpm preview` | Serve existing embedded build |
| `pnpm pwa:icons` | Regenerate PWA icons from `apps/embedded/public/icons/kinkagami-source.svg` |
| `pnpm typecheck` | Type-check `@kgm/core` and `@kgm/web` |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm db:migrate` | Load seed data into local DB |
| `pnpm db:seeds:generate` | Export current DB to seed files |
| `pnpm kiosk` | Launch Chromium in kiosk mode |

### Seeds and Board Migration

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

- exercises: `apps/embedded/src/db/exercises`
- routines: `apps/embedded/src/db/routines`
- manifest: `apps/embedded/setup/seeds/manifest.json`

Board workflow:

1. Build and generate seeds on your development PC.
2. Move the build output and project seed JSON files to the board.
3. On first run with empty local DB, the app bootstraps exercises and routines from those seed files.

### PWA Deployment (V3)

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
# Replace apps/embedded/public/icons/kinkagami-source.svg with your image, then:
pnpm pwa:icons
```

## Configuration

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
  - `type`: `fsm`, `grid`, or `hybrid`

A separate test config (`apps/embedded/src/config/testAppConfig.json`) provides browser-friendly defaults for the test suite.

The active evaluation mode controls how the Trainer score is computed.

## Architecture

### Deployment Targets

Three distinct build targets share the same codebase:

| Target | Inference | Camera | Use case |
|---|---|---|---|
| **V1 — Python** | Python backend via WebSocket | Hardware (MJPEG/stream) | Dedicated hardware mirror with specialized camera |
| **V2 — WASM/WebGL** | Browser workers (TF.js) | Hardware (MJPEG/stream) | Standalone kiosk without Python dependency |
| **V3 — PWA** | Browser workers (TF.js) | Device camera (getUserMedia) | Installable web app for mobile and desktop |

All three use the same inference abstraction layer. The active backend is selected by `runtime.execution` in app config, set at build time via environment variables.

### Current Runtime Model

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

### Trainer Flow

Current Trainer behavior:

1. Load selected routine and exercise item
2. Compute score continuously (based on `evaluation.type`)
3. Mark rep complete when score reaches threshold `80`
4. Continue until target reps are completed
5. Auto-advance to next exercise in routine
6. Show routine complete message at the end

### Exercise Validation Model

Exercises are versioned JSON definitions and remain the source of truth.

Each definition may include:

- `signals` (angle/distance/relative position)
- `event_graph` (FSM-like progression)
- `completion` terminal nodes
- `grid_validation` sequence rules
- optional timing constraints

This model supports deterministic validation and easy iteration.

### Offline Assets and Storage

- Model files are served from `apps/embedded/public/models`
- BlazePose MediaPipe files live in `apps/embedded/public/models/blazepose/mediapipe`
- Data is persisted locally (exercise/routine/session records)
- Database files are not exposed in `public`

**PWA (V3) caching strategy:**

- App shell (JS, CSS, HTML, WASM) is precached by the service worker at install time
- ML model files under `/models/` are excluded from precache and cached on first use (`CacheFirst`, 1-year TTL)
- After the first visit (including first inference run), the app works fully offline without any server

## Project Structure

pnpm workspace; root scripts (`pnpm dev`, `pnpm test`, ...) delegate to the right package.

```
apps/
├── embedded/        Current app: V1 Python / V2 workers / V3 PWA (offline-first)
├── web/             Online client served by URL (Vite + React Router), downloads models on first visit
├── mobile/          Reserved for the React Native client (not implemented yet)
packages/
├── core/            @kgm/core — platform-agnostic logic and ports (no DOM/React/TF.js)
└── ui/              @kgm/ui — presentational components + design tokens shared by embedded and web
backend/             Python WebSocket backend (V1)
setup/               Install / configure / run scripts
```

`apps/embedded/src/`:

```
src/
├── components/      Connected wrappers (inject hooks/context into UI)
├── inference/       Inference abstraction layer
│   ├── providers/   Backend-specific implementations (MoveNet, BlazePose, Python)
│   ├── usePoseInference.ts
│   └── useHandInference.ts
├── platform/        Adapters binding @kgm/core ports (PouchDB, localStorage)
├── hooks/           Application hooks
├── context/         React context providers
├── services/        Client-side services
├── views/           Page-level views
├── types/           Client-only types
├── config/          App and test configuration
├── db/              Database service and seed definitions
└── tests/           Test suite
```

## Testing

```bash
pnpm test       # vitest run
pnpm lint
```

## Design Principles

- Offline-first across all three targets
- Deterministic validation
- Clear separation of concerns
- Lightweight runtime choices for SBC constraints
- JSON contracts over hardcoded exercise logic
- Inference backend decoupled from consumer code — adding new targets requires no changes to consumers

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Agent guidance](AGENTS.md)

## Status & Roadmap

Progress tracking: see [PROGRESS.md](PROGRESS.md).

## License

_Not specified yet._
