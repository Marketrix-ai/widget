# Widget

Embeddable customer-support widget hosts drop into their own product via a script tag or npm
(`@marketrix.ai/widget`). It runs inside **arbitrary host pages**, so host isolation, a predictable
runtime and bundle size are first-class concerns.

ESM-only, `sideEffects: false`. **React 19 is a peer dependency and external to the bundle — the host
page must supply it.** Built with Vite 8 in **library mode** → a single ESM bundle `dist/widget.mjs`,
mounted into a **closed Shadow DOM** with all CSS injected as JS. Stack: TypeScript 6, Tailwind 4,
Zod 4, oRPC 1, `@rrweb/record` (optional), `@base-ui/react`.

**`README.md` is the real public API surface** — customer-facing integration docs live there; keep it
accurate. The root `../CLAUDE.md` owns cross-cutting rules (the widget↔api contract at the boundary,
status vocabulary, contract sync, ports, release order).

## Commands

```bash
npm start                # vite dev on :9001 (override PORT / VITE_PORT; CORS enabled)
npm run build            # → dist/widget.mjs (terser, single ESM) + tsc declarations
npm run type-check       # alias: check          npm run lint    # --fix, max-warnings 200
npm run test:run         # vitest (jsdom + Testing Library + axe)
npm run bundle:check     # bundle-size gate (artifact presence + size + sourcemap)
npm run code:check       # tsc + eslint + prettier --check (one-shot)
npm run ci               # every CI validation gate
npm run tag <version>    # scripts/release.sh
```

**Pre-handoff gate** (matching the repository-local Node 26 workflow): `npm run ci`. This public repo
cannot call private infra workflows. Git hooks autofix but are not a substitute.

**Hook setup is not automatic.** `core.hooksPath` is _local_ git config, so a fresh clone runs no hooks
until you point it at the committed shim: `git config core.hooksPath .husky/_`. Lefthook is the only
hook runner (there is no husky dependency, and lefthook is not a devDependency — install it yourself).
The shim sources **`.lefthookrc`** first to put node/npm back on `PATH` — hooks launched from GUI clients inherit a
minimal environment and otherwise die `npm: command not found`. **That rc path is baked in when hooks
are generated**, so after changing `rc:` you must re-run `lefthook install --force`.

## Packaging

- `main`/`module` = `./dist/widget.mjs`, `types` = `./dist/src/index.d.ts`, `files: ["dist"]` (there is
  no `.npmignore` — that allowlist is the whole publish surface).
- Vite lib mode: `formats: ['es']`, no code splitting, no CSS splitting, target `esnext`, terser with
  `drop_console`.
- **CSS is injected via JS** — no external stylesheet; it rides in the bundle and is mounted into the
  Shadow DOM from `index.css?inline`.
- **Externals** (resolved via the host importmap): `react`, `react-dom`, `react-dom/client`,
  `react/jsx-runtime`.
- Declarations come from a custom `closeBundle` plugin running `tsc -p tsconfig.build.json`.
- `public/loader.js` → `dist/loader.js` is the classic script-tag bootstrap.

## Widget ↔ api

Two typed oRPC procedures, both in `src/sdk/contracts/widget.ts`:

- **`widgetStream`** — GET, output `eventIterator(WidgetEventSchema)` (SSE), server → widget.
  **`application_id` is deliberately NOT an input** — accepting a bare, guessable application id as a
  credential let an anonymous caller drive any tenant's agent. It appears only on the `registered`
  event, as output.
- **`widgetMessagePost`** — POST, widget → server.

Both payloads are Zod **discriminated unions on `type`**:

- `WidgetEvent` — `registered`, `heartbeat`, `chat/response`, `chat/delta`, `chat/error`,
  `task/status`, `tool/call`.
- `WidgetCommand` — `chat/tell`, `chat/show`, `chat/do`, `chat/stop`, `tool/response`,
  `rrweb/metadata`, `rrweb/events`.

**Transport** — `src/services/StreamClient.ts` is a singleton wrapping the oRPC `sdk`, draining the
async iterator in the background. Status machine `disconnected → connecting → connected → registered →
error`, exponential-backoff reconnect (1000ms ×2, cap 30000ms, **max 10 attempts**; counters reset only
on `registered`). **A `chat/error` whose `request_id === 'auth'` is non-retriable and permanently stops
reconnection until re-init.**

**Round-trip** — `ChatContext.messageDispatch(content, mode)` fire-and-forget POSTs
`{type: 'chat/${mode}', request_id, content}` (mode defaults to `tell`); the reply arrives over SSE as
`chat/delta` fragments that **accumulate**, then a final `chat/response` carrying the full text
**replaces** them, matched by `request_id`.

**Tool execution** — `ChatContext` dedupes `tool/call` by `tool_call_id`, validates `browser_tool`
against `BROWSER_TOOLS`, executes via `browserToolService.executeTool`, then replies `tool/response`.
The `done` tool ends the task. `task/status` drives state: `running` **with a `task_id`** activates it
(one without is the agent starting before the api has minted one), the terminal three clear it and the
dedupe set.

**Interaction modes** map to commands and `InstructionType`: **Tell** = explain · **Show** =
`tool/call` with `mode: 'show'`, highlight via `ShowModeService` · **Do** = `mode: 'do'`, DOM actions
via `DomService`/`BrowserToolService`.

**Status vocabulary** — `task/status.status ∈ {running, completed, failed, stopped, has_question}` is
the canonical **wire** vocabulary (code branches on `'running'`). The presentational
`ChatMessage.taskStatus` (`done`/`failed`/`stopped`) and `MessagePart.status`
(`in_progress`/`completed`/`failed`) are **UI-only and NOT the wire vocabulary** — don't conflate them,
and don't widen either to a value nothing assigns.

**Session recording** — `RrwebSessionRecorder` batches to `rrweb/metadata` / `rrweb/events` only when
`widget_recording` is enabled. Disabled by default.

**Visibility** — `widget_appearance: 'hidden'` suppresses host-page UI while retaining initialization
(the dashboard preview deliberately stays visible); `widget_greeting_toast` independently controls the
welcome toast and does not alter the greeting message in chat.

## Init & isolation

- `window.__mtx = { state: 'initializing' | 'active' }` is the singleton guard — it survives ES-module
  re-execution and dedupes init; `initPromise` / `isInitializing` guard concurrent `initWidget` calls.
- **Closed Shadow DOM** (`attachShadow({ mode: 'closed' })`): the host cannot reach into the widget DOM,
  intentionally — don't expect host scripts or CSS to style or query inside it.
- **The runtime API host is not an env var** — it is supplied per-init as `mtxApiHost` (config) /
  `mtx-api-host` (script attr), and `configureSdk(apiUrl)` rebuilds the oRPC client. There is no
  baked-in API URL.

## SDK mirror (generated)

`src/sdk/contract.ts` + `contracts/*` are a **generated scoped mirror** of the api's widget audience —
**never hand-edit; regenerate from the api side.** `src/sdk/index.ts` is hand-written (the `sdk` proxy,
`configureSdk`, runtime/type re-exports). There is **no `routes.ts` and no `schema.ts`**.

Drift is enforced in **infra**, at the api tag this widget is pinned beside. **Widget gets a second
check the other consumers don't need**: `app` bundles this package **from npm at whatever its own
lockfile pins**, which is not the widget image tag deployed beside it, and `publish` runs at tag push
with no gate in front of it — so infra also checks the mirror of the widget version `app` actually
bundles, i.e. the build a browser really loads.

## Structure

**One config, one store, read from context.** `MarketrixWidget` is the only component that touches the
raw config prop — it validates it, persists it and publishes the resolved config (position and z-index
layered on) through `WidgetConfigContext`. Everything below calls `useWidgetConfig()` for settings and
`useWidget()` for the store; **never thread either down as props.** The widget is open or closed —
there is no minimized panel.

`src/index.tsx` (public entry — see `README.md` for the customer surface) · `src/services/` (stateful
runtime owners: `StreamClient`, `RrwebSessionRecorder`, `BrowserToolService`, `ShowModeService`,
`DomService`, `ChatService`, `ChatSessionManager`, `StorageService`,
`ScreenShareService`, plus stateless functions) · `src/components/` (`Surface` is the canonical
container primitive; `WidgetDialog` the one specialized modal;
`src/design-system/semantic-tokens.ts` owns settings-to-token adaptation) · `src/context/`
(`ChatContext` is one store `{messages, task}`, plus `UIStateContext`, `sseReducer`) · `src/test/` +
colocated `*.test.ts(x)`.

## Release & CI

`npm run tag <version>` bumps `package.json`, refreshes `package-lock.json`, builds, commits and
creates the annotated tag. Pushing `v*` independently fires the repo-local `image.yml` →
`marketrix.azurecr.io/widget:<version>` (**v-prefix stripped**) and `publish.yml` → npm. This public
repo cannot call Infra's private reusable image workflow, so its local build stays equivalent;
publication remains separate and skips an existing npm version. `ci.yml` runs only for pull requests
and pushes to `main`. Root `../CLAUDE.md` carries the full release order.

Docker: one file, stages `base` → `dev` / `builder` → `runtime` (node build → nginx serve, mime patched
to serve `.mjs`). Tilt builds `dev`, CI builds `runtime`, both inheriting `base`'s `npm ci`, so local
and shipped images cannot drift in their dependency set.

## Gotchas

- **Lockfile discipline** — any version or dependency change must run `npm install` and commit
  `package-lock.json` alongside `package.json`. `npm run tag` does it for you.
- **React importmap wins** — the loader's `esm.sh` importmap only fills gaps; a host on a different
  React 19 build keeps its own.

## Conventions

TS, 2-space indent, single quotes, semicolons, trailing commas, ~120-char lines; `type` imports, sorted
imports, no unused imports. `PascalCase` components/services/context, `useCamelCase` hooks, `camelCase`
utils. **Keep stateful services only for shared lifecycle/session ownership** — use plain functions for
stateless operations, and inline one-use presentation rather than adding a base component.
