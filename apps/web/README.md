# @kgm/web

Online Kinkagami client. Vite + React + React Router over `@kgm/core`.

```bash
pnpm dev:web        # http://localhost:5174
pnpm build:web      # -> apps/web/dist (includes models/movenet)
pnpm preview:web    # http://localhost:4174
pnpm test:web
```

- First visit: "downloading model" screen; weights are stored in the browser cache, later visits are instant (and work offline).
- Data is local-first (IndexedDB via PouchDB). Import exercise/routine JSON from the home screen.
- `VITE_KGM_MODELS_BASE_URL` serves weights from another host (see `.env.example`); otherwise they are copied from `apps/embedded/public/models/movenet` at build time.
- Camera and inference need a secure context (HTTPS or localhost). For HTTPS on custom hostnames or a phone: `pnpm certs:dev`, `pnpm hosts:add`, `pnpm dev:web:https` (see the root README).
- Import the file produced by embedded (Config → Datos → Exportar) from the home screen.
