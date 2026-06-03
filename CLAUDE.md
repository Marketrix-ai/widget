# Widget

Embeddable support widget customers drop into their own product via a script tag. Published to npm as `@marketrix.ai/widget`. Runs inside arbitrary host pages, so host-page safety, predictable runtime, and bundle size are first-class concerns.

Stack: React 19 (peer dep), Vite 8, TypeScript 6, Tailwind CSS 4 (`@tailwindcss/vite`), Zod 4, oRPC 1, `@rrweb/record` for session recording, `@base-ui/react` for primitives. Output is a single ESM bundle `dist/widget.mjs` plus a classic `loader.js`.

Dev server: `npm start` on port **9001** (`http://widget.marketrix.localhost`). Port is overridable via `PORT` / `VITE_PORT`.

## Commands

```bash
npm start                # vite dev server on :9001
npm run build            # vite build → dist/widget.mjs (terser) + tsc declarations
npm run code:check       # tsc --noEmit && eslint && prettier --check  (one-shot gate)
npm run code:fix         # eslint --fix && prettier --write
npm run type-check       # tsc --noEmit  (alias: check)
npm run lint             # eslint --fix (max-warnings 200); lint:check = max-warnings 0
npm run format:check     # prettier --check
npm run test:run         # vitest run (jsdom + Testing Library + axe)
npm run test             # vitest watch  (test:ui = watch, test:coverage = v8)
npm run visual:check     # scripts/visual-check.mjs   — gates on rendered UI
npm run a11y:check       # scripts/a11y-check.mjs      — gates on accessibility
npm run bundle:check     # scripts/bundle-check.mjs    — gates on bundle size
npm run tag <version>    # scripts/release.sh — see Release below
```

**Pre-handoff gates** (mirrors `ci.yml` `validate` job): `type-check`, `lint`, `build`, `format:check`, `test:run`, then `visual:check` + `a11y:check` + `bundle:check`. Git hooks (lefthook) run type-check + autofixing lint, but they are not a substitute — run the full set.

## Runtime model

- Mounts into a **closed Shadow DOM** (`attachShadow({ mode: 'closed' })` in `src/utils/bootstrap.tsx`) to prevent host CSS/DOM leakage. CSS is injected into the shadow root via `vite-plugin-css-injected-by-js` (no external stylesheet).
- `window.__mtx` is the **singleton guard** — duplicate/concurrent `initWidget` calls are deduplicated.
- Three credential modes (auto-detected by `mountWidget`):
  - **Production**: `mtxId` + `mtxKey`
  - **Dev**: `mtxApp` (application id) + `mtxAgent` (agent id)
  - **Preview**: rendered via the `<MarketrixWidget>` React component with inline `settings`
- All modes require `mtxApiHost`.

## Transport (widget ↔ api)

Two typed oRPC procedures, both defined in `src/sdk/contracts/widget.ts`:

- **`widgetStream`** — GET `/widget/stream`, an SSE `eventIterator(WidgetEventSchema)`. Server → widget events.
- **`widgetMessage`** — POST `/widget/message`, body `{ chat_id, command: WidgetCommandSchema }`. Widget → server commands.

Both schemas are **discriminated unions on `type`**:

- `WidgetEvent` types: `registered`, `pong`, `heartbeat`, `chat/response`, `chat/error`, `task/status`, `tool/call`.
- `WidgetCommand` types: `chat/tell`, `chat/show`, `chat/do`, `chat/stop`, `tool/response`, `ping`, `rrweb/metadata`, `rrweb/events`.

**Task status vocabulary (Wave 14):** `task/status.status` is `z.enum(['running', 'completed', 'failed', 'stopped', 'has_question'])`. Legacy `'started'` / `'in_progress'` were dropped — the widget now emits/consumes `'running'`. Matches the agent-side `SimulationTaskStatus` / `QATaskStatus`.

Interaction modes map to commands: **Tell** = `chat/tell` (explain), **Show** = `chat/show` (`tool/call` with `mode: 'show'`, visual highlighting), **Do** = `chat/do` (`tool/call` with `mode: 'do'`, performs browser actions).

## SDK mirror (must stay in sync)

The widget's SDK is a **scoped mirror** of the API contract, generated from the source of truth in the `api` repo:

| Source of truth (`api` repo) | Widget mirror |
|---|---|
| `api/contracts/widget.ts` + `contracts/*.ts` | `widget/src/sdk/contracts/*.ts` |
| `api/sdk/widget.ts` (scoped aggregate) | `widget/src/sdk/contract.ts` |

The widget mirror is per-domain contract fragments under `src/sdk/contracts/` (`widget.ts`, `agent.ts`, `application.ts`, `chat.ts`, `entities.ts`, `common.ts`, `activityLog.ts`) — there is **no** `src/sdk/routes.ts` or `src/sdk/schema.ts` (those are stale references). `src/sdk/contract.ts` assembles the `widgetContract` object; `src/sdk/index.ts` exports the oRPC client (`sdk`) plus `configureSdk()` and re-exports `WidgetEventSchema`, `WidgetSettingsDataSchema`, and contract types.

Drift is enforced by `.github/workflows/contract-drift.yml`: it sparse-checkouts `api@dev` and runs api's `scripts/sync-consumers.mjs widget --check`. **It requires the `CONTRACTS_READ_TOKEN` repo/org secret** (fine-grained PAT, Contents:read on `Marketrix-ai/api`) or it fails fast. Don't hand-edit `src/sdk/contracts/*` — regenerate from the api side and run the sync.

## Key services (`src/services/`)

- `StreamClient.ts` — SSE lifecycle: registration, auth-failure handling, exponential-backoff reconnects.
- `SessionRecorder.ts` — rrweb batching + POST flush. Thresholds: flush every **500 ms** (`FLUSH_INTERVAL_MS`) or at **50 KB** queued (`FLUSH_SIZE_THRESHOLD`); batches capped at **500 KB** (`MAX_BATCH_BYTES`, stays under the API body-parser limit); queue capped at 500 events; drops after 5 consecutive flush failures. Don't change these without updating the API's expectations.
- `ToolService.ts` / `ShowModeService.ts` / `DomService.ts` — tool execution, Show-mode highlighting, host-page DOM interaction.
- `ChatService.ts`, `SessionManager.ts`, `StorageService.ts`, `ConfigManager.ts`, `ValidationService.ts`, `WidgetService.ts`, `ApiService.ts`, `ScreenShareService.ts`.

## Structure

- `src/components/` — UI (`base/`, `blocks/`, `chat/`, `navigation/`, `ui/`, `views/`).
- `src/design-system/` — design tokens + primitives (keep token usage consistent).
- `src/services/` — see above. `src/hooks/`, `src/context/`, `src/utils/`, `src/lib/` — client state + helpers.
- `src/sdk/` — oRPC client + contract mirror (see above).
- `src/index.tsx` — public entry: `initWidget`, `mountWidget`, `unmountWidget`, `updateMarketrixConfig`, `getCurrentConfig`, `startRecording`/`stopRecording`/`getRecordingState`, `MarketrixWidget`.
- `src/test/` + `src/**/__tests__/` — vitest setup, fixtures, a11y helpers. Name tests `*.test.ts(x)` near the feature.
- `public/loader.js` — classic script-tag loader. `dist/` — generated only.

## Release

`@marketrix.ai/widget` is npm-published. Version is currently `3.8.9`.

1. `npm run tag <version>` (e.g. `npm run tag 3.8.10`) runs `scripts/release.sh`: bumps `package.json`, **`npm install` to refresh `package-lock.json`**, `npm run build`, commits `package.json` + `package-lock.json` as `chore(widget): release vX`, and creates annotated tag `vX`.
2. Push: `git push origin HEAD && git push origin v<version>`.
3. The `v*` tag triggers `ci.yml`: `build` job → `marketrix.azurecr.io/widget:<version>` (v-prefix stripped for image tag), `publish` job → npm (skipped if that version already exists, so sync-only tags are safe).
4. Bumping the app's pinned version: `cd ../app && npm install @marketrix.ai/widget@latest`, then deploy widget + app together via the centralized `deploy.yml` in `infra`.

**Lockfile rule:** any version bump or dependency change must run `npm install` and commit `package-lock.json` alongside `package.json`. `npm run tag` does this for you.

## Conventions

- TS, 2-space indent, single quotes, semicolons, trailing commas, ~120-char lines. `type` imports, sorted imports (simple-import-sort). `PascalCase` components/services/context, `useCamelCase` hooks, `camelCase` utils.
- Don't develop on `dev` — use a worktree/feature branch. Link the PR with `Closes #N`. Issue/PR body is the scope source of truth.
- Prefer extending shared services/utils over one-off logic in a component.
