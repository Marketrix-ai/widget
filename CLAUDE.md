# Widget

Embeddable customer-support widget that hosts drop into their own product via a script tag or npm package; published to npm as `@marketrix.ai/widget`. Runs inside arbitrary host pages, so host-page isolation, a predictable runtime, and bundle size are first-class concerns. Part of the Marketrix workspace — root `../CLAUDE.md` owns cross-cutting conventions (the widget↔api SSE+POST contract at the boundary, status enums, contract sync, ports, release/deploy order, the lockfile rule). Read it for anything cross-cutting. This file covers only what's specific to `widget/`.

## What this is

- Embeddable React widget, npm `@marketrix.ai/widget`, ESM-only, `sideEffects: false`.
- React **19** is a **peer dependency** (`react`/`react-dom` `^19.2.3`) and is **external** to the bundle — the host page must supply it.
- Built with Vite **8** in **library mode** → a single ESM bundle `dist/widget.mjs`.
- Mounts into a **closed Shadow DOM**; all CSS is injected as JS (no external stylesheet) and isolated inside the shadow root.
- Stack: TypeScript 6, Tailwind CSS 4 (`@tailwindcss/vite`), Zod 4, oRPC 1, `@rrweb/record` (session recording), `@base-ui/react` (primitives). ESLint 10 flat config. npm + `package-lock.json`.

Customer-facing integration docs live in `README.md` — keep that file accurate; it is the real public API surface.

## Commands

```bash
npm start                # vite dev server on :9001 (override PORT / VITE_PORT; CORS '*')
npm run build            # vite build → dist/widget.mjs (terser, single ESM) + tsc declarations
npm run type-check       # tsc --noEmit  (alias: npm run check)
npm run lint             # eslint --fix (max-warnings 200); lint:check = max-warnings 0
npm run format:check     # prettier --check  (format = --write)
npm run test:run         # vitest run (jsdom + Testing Library + axe); test = watch
npm run test:coverage    # vitest run --coverage (v8); test:ui = watch
npm run visual:check     # node scripts/visual-check.mjs   — rendered-UI gate
npm run a11y:check       # node scripts/a11y-check.mjs      — accessibility gate
npm run bundle:check     # node scripts/bundle-check.mjs    — bundle-size gate
npm run code:check       # tsc --noEmit && eslint && prettier --check  (one-shot)
npm run code:fix         # eslint --fix && prettier --write
npm run tag <version>    # scripts/release.sh — see Release
```

**Pre-handoff gates** (mirror `ci.yml` `validate`, Node 24): `type-check`, `lint`, `build`, `format:check`, `test:run`, then `visual:check` + `a11y:check` + `bundle:check`. Git hooks (lefthook `pre-commit`: `check` + `lint` with `stage_fixed`; plus a `.husky/` dir) autofix but are not a substitute — run the full set.

## Distribution & packaging

- `main`/`module` = `./dist/widget.mjs`; `types` = `./dist/src/index.d.ts`. `exports` map: `"."` → types + import `./dist/widget.mjs`, plus `"./package.json"`. `files: ["dist"]`.
- Vite lib mode: `formats: ['es']`, `entryFileNames: 'widget.mjs'`, `codeSplitting: false`, `cssCodeSplit: false`, target `esnext`, terser (`drop_console`).
- **CSS is injected via JS** (`vite-plugin-css-injected-by-js`) — no external stylesheet; the CSS rides in the bundle and is mounted into the Shadow DOM from `index.css?inline`.
- Externals (not bundled, resolved via the host importmap): `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`.
- Declarations: a custom closeBundle Vite plugin runs `tsc -p tsconfig.build.json` → `.d.ts` into `dist/src/`.
- `public/loader.js` is copied to `dist/loader.js` (classic script-tag bootstrap). `.npmignore` strips `src/`, `*.ts(x)` (except `*.d.ts`), configs, `*.html`, `*.map`.
- Build defines: `process.env.NODE_ENV='production'`, `__BUILD_COMMIT__` from the `BUILD_COMMIT` env (Docker build-arg, default `'dev'`).

## Architecture (widget ↔ api)

Two typed oRPC procedures, both defined in `src/sdk/contracts/widget.ts`:

- **`widgetStream`** — GET `/widget/stream`, output `eventIterator(WidgetEventSchema)` (SSE). Input `{ chat_id, tab_id?, marketrix_id?, marketrix_key?, application_id? }`. Server → widget.
- **`widgetMessage`** — POST `/widget/message`, input `{ chat_id, command: WidgetCommandSchema }`, output `{ ok }`. Widget → server.

Both payloads are Zod **discriminated unions on `type`**:

- `WidgetEvent` (server→widget): `registered` (`chat_id`, `application_id?`), `pong`, `heartbeat`, `chat/response` (`request_id`, `text`, `task_id?`), `chat/error` (`request_id`, `error`), `task/status` (`status`, `message?`, `task_id?`, `timestamp?`), `tool/call` (`call_id`, `tool`, `args`, `mode?` `'show'|'do'`, `explanation?`, `state_version?`).
- `WidgetCommand` (widget→server): `chat/tell`, `chat/show`, `chat/do` (each `request_id` + `content`), `chat/stop` (`task_id?`), `tool/response` (`call_id`, `success`, `data?`, `error?`, `state_version?`), `ping`, `rrweb/metadata`, `rrweb/events`.

**Transport** — `src/services/StreamClient.ts` is a singleton wrapping the oRPC `sdk`. It calls `sdk.widgetStream(input, { signal })` and drains the async iterator in the background. Status machine: `disconnected → connecting → connected → registered → error`. Exponential-backoff reconnect (1000 ms ×2, cap 30000 ms, **max 10 attempts**; counters reset only on a `registered` event). A `chat/error` whose `request_id === 'auth'` is **non-retriable** and permanently stops reconnection (until re-init). `heartbeat` is ignored. Sending uses `sdk.widgetMessage({ chat_id, command })`.

**Round-trip** — `ConversationContext.sendMessage(content, mode)` → `apiService.sendMessage` builds `{ type: 'chat/${mode}', request_id, content }` (mode defaults to `tell`) and fire-and-forget POSTs it; the reply arrives asynchronously over SSE as `chat/response`, matched by `request_id`. Task lifecycle arrives as `task/status`; agent browser actions arrive as `tool/call`.

**Tool execution** — `ConversationContext` handles `tool/call`: dedupe by `call_id`, validate `tool` against `BROWSER_TOOLS`, execute via `toolExecutionService.executeTool`, increment `state_version`, reply with `tool/response`. The `done` tool ends the task. `task/status` drives state: `running` activates the task (captures `task_id`); `completed`/`failed`/`stopped` clear it; `has_question` clears the pending state. `state_version` is a monotonic counter that orders tool calls.

**Interaction modes** map to commands and `InstructionType` (`'tell' | 'show' | 'do'`): **Tell** = `chat/tell` (explain); **Show** = `chat/show` (`tool/call` with `mode: 'show'`, highlight via `ShowModeService`); **Do** = `chat/do` (`tool/call` with `mode: 'do'`, DOM actions via `DomService`/`ToolService`).

**Session recording** — `src/services/SessionRecorder.ts` batches rrweb events and POSTs them via the sdk (`rrweb/metadata` + `rrweb/events`). Requires both `chatId` and `applicationId`. Thresholds: queue cap 500 events, flush at 50 KB queued (`FLUSH_SIZE_THRESHOLD`), batch cap 500 KB (`MAX_BATCH_BYTES`, under the API 5 MB body limit), flush interval 500 ms, drop after 5 consecutive flush failures. `chat_id` is created via `sdk.chatCreate(undefined)` in `SessionManager`. Don't change these without updating the API's expectations.

**Status vocabulary** — `task/status.status ∈ { running, completed, failed, stopped, has_question }` (this is the canonical wire vocabulary; legacy `'started'`/`'in_progress'` are absent — code branches on `'running'`). Separately, the presentational `ChatMessage.taskStatus` (`'ongoing'|'done'|'failed'|'stopped'`) and `MessagePart.status` (`'in_progress'|'completed'|'failed'|'stopped'`) are **UI-only** and are NOT the wire vocabulary — don't conflate them.

## Init & isolation

- `window.__mtx = { state: 'initializing' | 'active' }` is the singleton guard; it survives ES-module re-execution and dedupes init. `initPromise` / `isInitializing` guard concurrent `initWidget` calls. One production widget per page (`isProductionWidgetActive`).
- **Closed Shadow DOM**: `attachShadow({ mode: 'closed' })` in `src/utils/bootstrap.tsx`; CSS injected as a `<style>` (from `index.css?inline`) into the shadow root. The host cannot reach into the widget DOM (intentional).
- The runtime API host is NOT an env var — it's supplied per-init as `mtxApiHost` (config) / `mtx-api-host` (script attr). `configureSdk(apiUrl)` rebuilds the oRPC client; there is no baked-in API URL.

## SDK mirror (generated)

The widget's SDK is a **scoped mirror** of the api contract, generated from the source of truth in the `api` repo.

- `src/sdk/index.ts` exports the `sdk` proxy (forwards to the current oRPC client) + `configureSdk` + runtime/type re-exports (`WidgetEventSchema`, `WidgetSettingsDataSchema`, contract types).
- `src/sdk/contract.ts` assembles `widgetContract`.
- `src/sdk/contracts/*.ts` are the per-domain fragments: `widget.ts`, `application.ts`, `chat.ts`, `entities.ts`, `common.ts`, `activityLog.ts`. There is **no** `src/sdk/routes.ts` and **no** `src/sdk/schema.ts` (re-exports come from `index.ts`).

Drift is enforced by `.github/workflows/contract-drift.yml` (PRs touching `src/sdk/**`, weekly Mon 06:00, manual): it sparse-checkouts `Marketrix-ai/api@dev` (`contracts/`, `sdk/`, `scripts/sync-consumers.mjs`) and runs `node .api-src/scripts/sync-consumers.mjs widget --check --api-root .api-src --dest src/sdk`. It authenticates with the org-level **`INFRA_PAT`** secret (provisioned for cross-repo access) as `GH_TOKEN` — no per-repo secret required. Don't hand-edit `src/sdk/contracts/*` — regenerate from the api side (root `sync-contracts` skill) and re-run the sync, or the gate fails.

## Structure

- `src/index.tsx` — public entry; all exports (see `README.md` for the customer surface).
- `src/services/` — `StreamClient`, `SessionRecorder`, `ToolService`, `ShowModeService`, `DomService`, `ChatService`, `SessionManager`, `StorageService`, `ConfigManager`, `ValidationService`, `WidgetService`, `ApiService`, `ScreenShareService`.
- `src/components/` — UI (`base/`, `blocks/`, `chat/`, `navigation/`, `ui/`, `views/`, `MarketrixWidget.tsx`). `src/design-system/` — tokens + primitives.
- `src/context/` — `ConversationContext` (one store: `{ messages, task }`), `UIStateContext`, `WidgetProviders`, `sseReducer.ts`. `src/hooks/`, `src/utils/` (incl. `bootstrap.tsx`), `src/lib/`, `src/constants/`, `src/types/`.
- `src/test/` + colocated `*.test.ts(x)` — vitest setup, fixtures, a11y helpers.
- `public/loader.js` — classic script-tag bootstrap. `index.html` — playground harness. `dist/` — generated only.

## Release

`npm run tag <version>` (`scripts/release.sh`): bumps `package.json`, runs `npm install` to refresh `package-lock.json`, `npm run build`, commits both files as `chore(widget): release vX`, and creates annotated tag `vX`. Then `git push origin HEAD && git push origin v<version>`. The `v*` tag triggers `ci.yml`: `build` → `marketrix.azurecr.io/widget:<version>` (v-prefix stripped; `BUILD_COMMIT`), `publish` → `npm publish --access public` (skipped via `npm view` if that version already exists). See root `../CLAUDE.md` for the full widget release order (push tag → bump app dep → deploy both via `infra/deploy.yml`).

## CI/CD

- `ci.yml` (push `dev`/tags `v*`/PRs to `dev`): `validate` (non-tag) → `npm ci`, type-check, lint, build, format:check, test:run, visual/a11y/bundle checks (Node 24); `build` (`v*` only) → strip `v`, ACR login, build+push image; `publish` (`v*` only) → build, skip-if-already-published guard, `npm publish` with `NPM_TOKEN`.
- `contract-drift.yml` — see SDK mirror above.
- Docker: 2-stage `Dockerfile` (`node:26-alpine` build → `nginx:1.31.1-alpine` serve as the `nginx` user; mime patched to serve `.mjs`). `Dockerfile.dev` runs `vite dev --host 0.0.0.0 --port 9001` with a 256 MB heap. Container `EXPOSE 9001`; nginx `/health` → `200 ok`.

## Gotchas

- **Lockfile discipline.** Any version bump or dependency change must run `npm install` and commit `package-lock.json` alongside `package.json`. `npm run tag` does this for you.
- **v-prefix asymmetry.** Git tag `vX.Y.Z` → image `marketrix.azurecr.io/widget:X.Y.Z` (the build pipeline strips the `v`).
- **React external + peer.** The host MUST provide React 19. The script-tag loader injects an `esm.sh` importmap, but **host importmap mappings win** — a host on a different React 19 build keeps its own.
- **Closed Shadow DOM.** The host can't reach into the widget DOM by design — don't expect host scripts/CSS to style or query inside it.
- **Sticky auth error.** A `chat/error` with `request_id: 'auth'` permanently stops SSE reconnection until the widget is re-initialized.
- **SDK mirror is generated.** Don't hand-edit `src/sdk/contracts/*` — regenerate from api or `contract-drift.yml` fails.

## Conventions

- TS, 2-space indent, single quotes, semicolons, trailing commas, ~120-char lines. `type` imports, sorted imports (`simple-import-sort`), `unused-imports`. `PascalCase` components/services/context, `useCamelCase` hooks, `camelCase` utils.
- Don't develop on `dev` — use a worktree/feature branch; link the PR with `Closes #N`. Issue/PR body is the scope source of truth (see root workflow).
- Prefer extending a shared service/util over one-off logic in a component.
