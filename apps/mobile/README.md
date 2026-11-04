# apps/mobile (reserved)

Placeholder for the React Native client. Not implemented yet and intentionally
not a workspace package (no `package.json`), so it does not affect installs or builds.

Plan when implemented:

- Reuse `@kgm/core` for pose math, exercise model, scoring, `trainerSession` and the `AppConfig` schema.
- Provide its own composition root implementing the core ports:
  - `ExerciseRepository` / `RoutineRepository`: SQLite or AsyncStorage
  - `ConfigStore`: AsyncStorage
  - `PoseSource`: native on-device model via a camera frame processor, normalized to the same COCO keypoint names core expects
- Own UI components (the DOM/SCSS `ui/` of embedded is not reusable); share design tokens and `locales/*.json`.
- Metro + pnpm may need `node-linker=hoisted` or extra Metro config for the monorepo.
