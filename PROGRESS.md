# Kinkagami (Smart Fitness Mirror) — PROGRESS

> Local-first fitness mirror with pose detection; pnpm monorepo with 3 targets (V1 Python, V2 WASM/WebGL, V3 PWA).

_Last updated: 2026-11-04_

## Legend

| Status | Meaning |
|---|---|
| ⚪ **To Do** | Not started |
| 🟡 **In Progress** | Being worked on (recent or uncommitted changes) |
| 🟢 **Done** | Finished |
| 🔴 **Blocked** | Blocked by something external or an open problem |

**Priority:** `P0 > P1 > P2 > P3` — sections go from highest to lowest priority.
Within a section all tasks have equal priority (`P1 = P1`) and are listed in suggested execution order.

| Level | Meaning |
|---|---|
| P0 | Critical / blocks the project goal |
| P1 | High: next milestone |
| P2 | Medium: planned improvement |
| P3 | Low / exploratory / long term |

## Tasks

### P0 — Critical

| Status | Task | Notes |
|---|---|---|
| 🟡 In Progress | Monorepo reorganization: move config/env to `apps/embedded`, `apps/web`, `packages/core` and `packages/ui` | Layout migrated; typecheck, tests (core/ui/web/embedded) and builds (embedded, PWA, web) pass. Lint clean. Pending: commit (needs Node 22 for embedded tests) |
| 🟢 Done | V1 Python / V2 workers / V3 PWA with inference abstraction | v0.0.22 |

### P1 — High

| Status | Task | Notes |
|---|---|---|
| 🟡 In Progress | Online web client (`apps/web`): model download on first visit + Cache API | Shares `@kgm/core` and `@kgm/ui` with embedded |
| ⚪ To Do | Verify parity of the 3 targets (V1/V2/V3) after the reorganization | `pnpm test`, `lint`, `build:pwa` |
| 🟢 Done | `@kgm/core` with ports (repos, config, PoseSource) and `@kgm/ui` |  |

### P2 — Medium

| Status | Task | Notes |
|---|---|---|
| ⚪ To Do | Additional scoring modes | ARCHITECTURE §15 |
| ⚪ To Do | Advanced routine feedback and post-session analytics | ARCHITECTURE §15 |
| ⚪ To Do | Exercise authoring UX | ARCHITECTURE §15 |
| 🟢 Done | Dev HTTPS (`.certs`, hosts scripts) and PWA with Workbox |  |

### P3 — Low

| Status | Task | Notes |
|---|---|---|
| ⚪ To Do | Optional PouchDB → remote CouchDB sync | Hook already exists in `dbService.ts` |
| ⚪ To Do | New inference backends (ONNX, WebGPU) |  |
| ⚪ To Do | More runtime partitioning into workers |  |
| ⚪ To Do | React Native mobile client (`apps/mobile`) | Reserved, not implemented |

---

_Statuses inferred from READMEs/roadmaps/git on 2026-11-03; adjust anything that does not reflect reality._
