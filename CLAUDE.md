# Widget

Embeddable support widget that customers integrate into their products. Communicates with the API (`api/`) via SSE streaming and HTTP POST.

## Stack

- **Language**: TypeScript 5.9 (strict), React 19
- **Build**: Vite 6 (dual build: library + standalone)
- **Styling**: Tailwind CSS 4
- **Validation**: Zod
- **API Client**: oRPC (`@orpc/client`, `@orpc/contract`)
- **Session Recording**: rrweb 2 (batched POST via widget stream)
- **Dev**: ESLint, Prettier, npm

## Key Files

| File | Purpose |
|------|---------|
| `src/sdk/index.ts` | oRPC client with Proxy pattern for dynamic URL (`configureSdk()`) |
| `src/sdk/routes.ts` | oRPC contract definitions — **mirror of** `api/routes.ts` |
| `src/sdk/schema.ts` | Zod schemas (incl. `WidgetEventSchema`, `WidgetCommandSchema`) — **mirror of** `api/schema.ts` |
| `src/services/StreamClient.ts` | SSE stream client (auto-reconnect, exponential backoff) |
| `src/services/ChatService.ts` | HTTP POST for chat commands (tell/show/do/stop) |
| `src/services/SessionRecorder.ts` | rrweb recording → batched POST to API (500ms/50KB flush) |
| `src/context/` | WidgetContext provider for state management |
| `src/components/` | React components (chat, layout, UI, input, debug) |
| `src/utils/bootstrap.ts` | Widget initialization and mounting |
| `vite.config.ts` | Dual-build config (library + standalone) |
| `nginx.conf` | Production static file server |

## Terminology

The widget is the runtime component of what users call **User Support** in the dashboard. It connects to an **Application** (code: `connection`) and an **Agent**. See root `CLAUDE.md` glossary for full terminology.

## Conventions

### Embedding Modes
- **Production**: `initWidget({ mtxId, mtxKey })` — customer credentials
- **Preview**: `MarketrixWidget` React component — settings preview in dashboard
- **Dev**: `mountWidget({ mtxApp, mtxAgent })` — direct app/agent IDs
- Shadow DOM isolation prevents CSS conflicts with host app
- Window guard: `window.__mtx` tracks initialization state

### Communication with API
- **SSE stream**: `widgetStream` endpoint — server pushes typed `WidgetEvent` objects
- **HTTP POST**: `widgetMessage` endpoint — widget sends `WidgetCommand` objects
- Typed discriminated unions: `WidgetEventSchema` (server→widget), `WidgetCommandSchema` (widget→server)
- Auth validated once on stream connect; stored per-connection on API side

### Build Output
- Library build: `dist/index.mjs` (React as peer dep)
- Standalone build: `dist/standalone.mjs` (React bundled)
- CSS injected inline via `vite-plugin-css-injected-by-js`
- Types: `dist/src/**/*.d.ts`

### Cross-Repo Impact
- `src/sdk/routes.ts` must stay in sync with `api/routes.ts`
- `src/sdk/schema.ts` must stay in sync with `api/schema.ts`
- Published as `@marketrix.ai/widget` — consumed by `app/` for preview

## Commands

- `npm start` — Vite dev server (port 5174)
- `npm run build` — dual library + standalone build
- `npm run lint` — ESLint
