# Design System

## Context

This design system belongs to a **smart fitness mirror**: a semi-transparent display mounted over a physical mirror, controlled exclusively through **hand gestures** detected by camera. There is no keyboard, mouse, or touchscreen.

Environmental constraints that guide every design decision:

- **Overlay on the mirror**: the UI renders on top of the user's reflection. Opaque backgrounds block the view; semi-transparent backgrounds or `backdrop-filter` surfaces are preferred.
- **Reading distance**: the user stands 1–2 meters in front of the mirror. Text must be legible at that distance without appearing oversized on the 1268×720 display.
- **Mirror contrast**: the reflection is a dynamic, complex background (clothing, walls, ambient light). Text and interactive elements **must have high contrast** against any background. Prefer white or phosphorescent green over dark semi-transparent surfaces.
- **No peripherals**: all interaction is gesture-driven. Interactive elements must be large and have unambiguous hover/focus states so the hand cursor is clearly recognizable.
- **Limited hardware (Radxa SBC)**: avoid high GPU-cost effects (excessive blur, multiple stacked `backdrop-filter` layers). Prefer simple CSS animations.
- **Single screen per view**: the target resolution is 1268×720. The layout must fill the space completely and never require scroll.

---

## Typography

The base font is declared in `:root` and cascades to all components.

- **Family (UI)**: `Inter, Avenir, Helvetica, Arial, sans-serif`
- **Family (debug/mono)**: `"SF Mono", "Consolas", "Liberation Mono", monospace`

### Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Display | `clamp(56px, 10vw, 120px)` | 700–800 | Final score, large counter |
| Headline 1 | `1.5rem` (24px) | 700 | View title (`CardLayout h1`) |
| Headline 2 | `1.2rem` (19px) | 600 | Card title (`ExerciseCard`, `RoutineCard`) |
| Body | `1rem` (16px) | 400 | Paragraph text, buttons |
| Body small | `0.85–0.9rem` | 400 | Description, secondary metadata |
| Label | `0.75–0.8rem` | 600 | Pills, tags, badges |
| Caption | `0.7–0.72rem` | 400 | Muscle group labels, sub-labels |
| Micro (debug) | `9–10px` | 400/700 | `DevInfoSnackbar` only |

**Rules:**
- `line-height: 1` for large headings; `line-height: 1.5` for body paragraphs.
- Use `-webkit-line-clamp` to truncate long descriptions (max 2–3 lines).
- Never go below `0.7rem` for text visible from the mirror.

---

## Colors

The system does not require opaque backgrounds. Surfaces use `rgba` with low opacity to preserve mirror transparency.

### CSS token palette (`--kgm-*`)

Tokens are defined in `:root` inside `App.css` and overridden per theme (`[data-kgm-theme="sunset"]`, `[data-kgm-theme="ocean"]`).

#### Surfaces (element backgrounds)

| Token / Value | Usage |
|---------------|-------|
| `rgba(0, 0, 0, 0.45)` | Button idle surface |
| `rgba(0, 0, 0, 0.84)` | Debug snackbar, info overlays |
| `rgba(0, 0, 0, 0.7–0.9)` | Modals, high-priority panels |
| `rgba(255,255,255, 0.08–0.12)` | Chips, tags, input backgrounds over mirror |
| `#0d1117` / `#161b22` | Opaque internal backgrounds (DebugFSM canvas) |

#### Interaction colors (default theme)

| Role | Color | Token |
|------|-------|-------|
| **Hover / Focus (border)** | `rgba(74, 255, 168, 0.98)` — phosphorescent green | `--kgm-button-hover-border` |
| **Hover (surface)** | `rgba(36, 128, 86, 0.26)` | `--kgm-button-hover-surface` |
| **Hover glow** | `0 0 22px rgba(74,255,168,0.38)` | `--kgm-button-hover-glow` |
| **Confirmed focus** | `rgba(74, 255, 168, 0.95)` | `--kgm-button-focus-border` |
| **Checkbox hover** | `rgba(255, 210, 102, 0.98)` — amber | `--kgm-button-checkbox-hover-border` |
| **Checkbox checked** | `rgba(88, 214, 141, 0.98)` — emerald green | `--kgm-button-checkbox-checked-border` |
| **Checkbox checked+focus** | `rgba(80, 220, 255, 1)` — cyan | `--kgm-button-checkbox-checked-focus-border` |
| **Loading sweep** | `rgba(96, 176, 255, 0.78)` — ice blue | `--kgm-button-loading-gradient-3` |

#### Semantic state colors

| State | Color |
|-------|-------|
| Success / Start node | `#238636` / `#2ea043` — GitHub green |
| Warning / mid FPS | `rgba(255, 210, 60, 0.95)` — amber |
| Error / low FPS | `rgba(255, 80, 80, 0.95)` — red |
| Difficulty: beginner | `bg #2e7d32 / text #c8e6c9` |
| Difficulty: intermediate | `bg #f57c00 / text #ffe0b2` |
| Difficulty: advanced | `bg #c62828 / text #ffcdd2` |

#### Text

| Role | Color |
|------|-------|
| Primary (on dark) | `#ffffff` |
| Secondary / muted | `#aaa` / `#888` / `rgba(255,255,255,0.7)` |
| Debug muted | `rgba(190, 215, 255, 0.8)` |
| FSM node text | `#e6edf3` / muted `#8b949e` |

---

## Components

### Button (`kgm-button`)

The central interactive component. Its visual states are **the only indicators** that the user's hand is over it — there is no mouse hover.

- **Idle**: border `rgba(255,255,255,0.35)`, background `rgba(0,0,0,0.45)`
- **Gesture hovered**: phosphorescent green border + outer glow + radial inward animation on `::before`
- **Focused (gesture confirming)**: solid green border, background `rgba(74,255,168,0.22)`
- **Checkbox checked**: emerald border, inner glow `rgba(88,214,141,0.3)`, visible checkmark
- **Loading**: animated blue sweep gradient over 1.45 s

Minimum interactive hit area: **140×140 px** (nav buttons) · **200×200 px** (primary buttons). Text-only buttons must have `minHeight: 200px`.

### CardLayout

Full-screen layout structure. The content area (`__content`) uses `flex: 1; min-height: 0` so the carousel height adapts to available space without scroll. Currently displays **1 card** per page.

Side navigation buttons have a `160px` slot width and `140px` button size.

### HandCursorOverlay

Replaces the system cursor. Always visible when a hand is detected. Composed of:
- **Inner ring** (28×28 px): soft idle pulse at 1.15 s
- **Progress ring**: outer ring that contracts from `scale(1.9)` to `scale(0.3)` as the fist closes
- **Center dot**: fixed reference point

The cursor uses `translate3d` for GPU compositing. Always `pointer-events: none`.

### ExerciseCard / RoutineCard

Cards that stretch to fill available space (`height: 100%`). No fixed `min-height` so they adapt to the flexible layout. Display a maximum of 3 muscle group tags plus an overflow counter.

---

## Screens

### User-facing (included in production build)

These screens form the gesture-controlled runtime experience. They are always active and rendered over the camera feed.

| Screen | Route | Description |
|--------|-------|-------------|
| **Splash** | `/stack/splash` | Entry point. Waits for camera and model to be ready. Shows a loading indicator if the stream URL is not yet available. Navigates to Routines on success or to Error on failure. |
| **Routines** | `/stack/routines` (default) | Lists saved routines one at a time. The user selects a routine via gesture and navigates to the session. Routines can be deleted from this screen. |
| **Exercises** | `/stack/exercises` | Lists available exercises one at a time. The user selects exercises and configures reps to compose a new routine, then saves it. |
| **Session** | `/stack/session` | Active workout session. Composed of two overlapping layers: **Trainer** (pose comparison + FSM evaluation) and **Score** (live score overlay). Both share a `SessionComparisonContext`. |
| **Settings** | `/settings` | Placeholder settings screen. Not yet implemented. |
| **Error** | `/error` | Displayed when camera or model initialization fails. Shows the specific error message. |
| **Summary** | `/summary` | Post-session summary screen. Not yet implemented. |

> The root path `/` redirects to `/stack/splash`.
> `Canvas` is not a routed screen — it is a persistent background layer that runs pose and hand detection continuously, active across all stack routes.

---

### Dev / management screens (dev build only)

These screens are registered as routes **only when `import.meta.env.DEV` is `true`**. In production they redirect to `/stack/splash`. They are tools for authoring and debugging exercise content.

| Screen | Route | Description |
|--------|-------|-------------|
| **Create** | `/create` | Exercise recording tool. Loads a reference video, captures pose keypoints frame by frame using BlazePose, and generates the exercise JSON with its event graph and angle data. Saves the result to the local DB. |
| **Player** | `/player` | Playback and inspection tool. Lists recorded exercises, animates their skeleton frame by frame, and overlays the FSM debug graph (`DebugFSM`). Useful for validating recordings and tuning the event graph. |
| **Models** | `/models` | Model testing sandbox. Runs MoveNet, BlazePose, and HandPose side by side over the live camera feed with debug overlays, FPS counters, and verbose logging. |
| **Config** | `/config` | Runtime configuration panel. Exposes `AppConfig` settings (pose model, TF backend, evaluation type, camera flow, etc.) without requiring a code change or rebuild. Available in dev only. |

---



### ✅ Do

- Use semi-transparent backgrounds (`rgba` with alpha ≤ 0.9) to preserve the mirror view.
- Keep text contrast ≥ 4.5:1 against the darkest expected background (black shirt reflected).
- Use phosphorescent green (`rgba(74,255,168,0.98)`) as the primary action color — it is the single hue the user learns to associate with "you can interact here".
- Design all interactive elements with a minimum area of 140×140 px.
- Use CSS animations (`transform`, `opacity`) for visual feedback; avoid triggering layout changes inside animations.
- Apply `pointer-events: none` to all decorative overlays (cursor, skeleton canvas).
- Keep the full UI visible at 1268×720 without scroll. One screen = one action.
- Use CSS tokens (`--kgm-*`) for interaction colors; do not hardcode values in component overrides.

### ❌ Don't

- Don't use fully opaque backgrounds over large areas — they block the reflection, which is the mirror's purpose.
- Don't stack more than one `backdrop-filter: blur()` layer at a time (high GPU cost on Radxa).
- Don't show more than 1 main content card on screen. The space and reading distance don't allow it.
- Don't use font sizes below `0.7rem` for text the user must read from the mirror.
- Don't rely on tooltips, mouse hover, or keyboard focus as the sole indicator of an interactive element — the user interacts with gestures.
- Don't add vertical scroll to main views. If the content doesn't fit, redesign the hierarchy.
- Don't run more than 2 simultaneous animations in the same screen area.
- Don't expose debug controls (`DevInfoSnackbar`, `DebugFSM`) in production builds.

