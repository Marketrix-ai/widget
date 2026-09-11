# Widget

Embeddable customer-support widget hosts drop into their own product via a script tag or npm
(`@marketrix.ai/widget`). It runs inside **arbitrary host pages**, so host isolation, a predictable
runtime and bundle size are first-class concerns.

ESM-only, `sideEffects: false`. **React 19 is a peer dependency and external to the bundle — the host
page must supply it.** Built with Vite 8 in **library mode** → a single ESM bundle `dist/widget.mjs`,
mounted into a **closed Shadow DOM** with all CSS injected as JS. Stack: TypeScript 6, hand-written
CSS, oRPC 1, `@rrweb/record` (optional), `@base-ui/react`.

**`README.md` is the real public API surface** — customer-facing integration docs live there; keep it
accurate. The root `../CLAUDE.md` owns cross-cutting rules (the widget↔api contract at the boundary,
status vocabulary, contract sync, ports, release order).

## Commands

```bash
bun start                # vite dev on :9001 (override PORT / VITE_PORT; CORS enabled)
bun run build            # → dist/widget.mjs (terser, single ESM) + tsc declarations
bun run type-check       # alias: check          bun run lint    # --fix, max-warnings 200
bun run test             # bun test (jsdom preload + Testing Library + axe-core)
bun run test:watch       # bun test --watch
bun run test:coverage    # bun test --coverage
bun run bundle:check     # packaging gate (size, single chunk, no CSS file, React external)
bun run code:check       # tsc + eslint + prettier --check (one-shot)
bun run ci               # every CI validation gate
bun run tag <version>    # scripts/release.sh
```

**Tests run on `bun test`, not vitest** — vitest, `@vitest/coverage-v8` and `vitest-axe` are gone from
devDependencies. `src/test/preload.ts` (the `bunfig.toml` `[test] preload`) is the sole DOM bootstrap:
a hand-installed jsdom `Window`, with `window` made self-referential to `globalThis` (matching a real
browser's top frame and vitest's own jsdom environment) so tests that redefine `window.location` via
`Object.defineProperty` keep working despite jsdom's own `Window.prototype.location` being
non-configurable. `src/test/vi-compat.ts` is the one home for the handful of `vi.*` helpers bun's
`vitest`-compat shim doesn't implement (`mocked`, `hoisted`, `advanceTimersByTimeAsync`, `waitFor`,
`restoreModuleAfterAll`) — reach for it before hand-rolling another one-off shim. **`bun test` always
runs with `--isolate`** (every `test`/`test:watch`/`test:coverage` script bakes it in): unlike vitest,
plain `bun test` runs every file in ONE process/global object, so a `vi.mock`/`vi.spyOn`/module-level
singleton state from one file can leak into another purely by file-discovery order — the exact bug
class behind three real cross-file pollution failures found porting this suite (a `vi.spyOn` leak, a
`vi.mock('../sdk')` leak, and `ScreenShareService`'s own real module state outliving its test file),
one of which reproduced ONLY on CI's Linux runner, never locally on macOS or in a `linux/amd64` Docker
container. `--isolate` closes the whole class at the runner level; keep any new mock/spy scoped to its
own file regardless; don't remove the flag to "speed up" a run. Filter a run with `bun test <pattern>`;
a single file with `bun test path/to/file.test.ts`.

**Pre-handoff gate** (matching the repository-local bun workflow): `bun run ci`. This public repo
cannot call private infra workflows. Git hooks autofix but are not a substitute.

**Hooks install themselves.** `lefthook` is a devDependency whose `postinstall` runs `lefthook install -f`,
so a plain `bun install` writes the pre-commit shim into the effective hooks path — `.git/hooks` by
default — and a fresh clone needs no `git config core.hooksPath`. It is skipped only when `CI` is
set. **A global `core.hooksPath` hijacks the target**: lefthook installs there instead, unscoping
this repo's hook to every repo on the machine. Lefthook is the only hook runner (there is no husky
dependency, and `bun install` puts the binary at `node_modules/lefthook/bin/index.js`, where the shim
looks).
The shim sources **`.lefthookrc`** first to put bun back on `PATH` — hooks launched from GUI clients inherit a
minimal environment and otherwise die `bun: command not found`. **That rc path is baked in when hooks
are generated**, so after changing `rc:` you must re-run `lefthook install --force`.

## Packaging

- `main`/`module` = `./dist/widget.mjs`, `types` = `./dist/src/index.d.ts`,
  `files: ["dist", "!dist/**/*.map"]` (there is no `.npmignore` — that allowlist is the whole publish
  surface). The map is built but never published; `sourcemap: 'hidden'` keeps the bundle from
  advertising one it does not ship.
- Vite lib mode: `formats: ['es']`, no CSS splitting, target `esnext`, terser with `drop_console`.
  **`codeSplitting: false` belongs on `rolldownOptions.output`** — Vite never reads it from `build`,
  where it was a no-op that read like a guarantee.
- **CSS is injected via JS** — no external stylesheet; it rides in the bundle and is mounted into the
  Shadow DOM from `index.css?inline`.
- **Externals** (resolved via the host importmap): `react`, `react-dom`, `react-dom/client`,
  `react/jsx-runtime`.
- Declarations come from a custom `closeBundle` plugin running `tsc -p tsconfig.build.json`.
- `public/loader.js` → `dist/loader.js` is the classic script-tag bootstrap.
- **The runtime image serves an allowlist, not `dist/`.** The Dockerfile names each served file, so
  the sourcemap (which embeds the whole source) and the `.d.ts` tree stay unpublished; a new served
  artifact must be added there by hand. `widget.mjs.gz`/`.br` are precompressed in the builder stage,
  and nginx has no brotli module — `gzip_static` covers gzip, a `try_files` on `Accept-Encoding`
  covers brotli. Nothing is compressed per request.
- **`bundle:check` budgets each bundled dependency, not just the total** — a total cap cannot see
  which dependency grew. Two are about half of it: `@base-ui/react` + `/utils` and `@rrweb/record`
  (a feature off by default). A package missing from `DEPENDENCY_BUDGETS`
  fails the gate, so a new import is a deliberate line.
- **zod is a type-only dependency of the BUNDLE, and a real one of the package.** Nothing in
  `src/` imports it as a value any more — `parseWidgetSettings` in `utils/validation.ts` is the one
  home for settings validation, a `satisfies`-checked guard table that a contract change breaks at
  compile time. Importing `WidgetSettingsDataSchema` (or any schema) as a VALUE anywhere reachable
  from `src/index.tsx` pulls zod's whole runtime back into every host page: rolldown cannot prove
  `z.object(...)` pure, so one value import retains the entire mirror's schema graph. It stays in
  `dependencies` because the published `.d.ts` files still reference it, and it stays importable in
  tests — `utils/__tests__/validation.test.ts` uses the real schema as the oracle the guard is
  checked against.
- **A single chunk means an import is unconditional** — a heavy dependency behind an off-by-default
  flag still ships to every host page. Weigh that at the import, because the packaging contract has no
  later escape.

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
async iterator in the background. Status machine `disconnected → connecting → open → registered`, plus
`error` from any failed connect or stream — **`open` is the transport, `registered` is the chat**, so
`isConnected()` reads `registered` and nothing waits on `open`. Exponential-backoff reconnect (1000ms
×2, cap 30000ms, **max 10 attempts**; counters reset only on `registered`). **A `chat/error` whose
`request_id === 'auth'` is non-retriable and permanently stops reconnection until re-init.**

**Round-trip** — `ChatContext.messageDispatch(content, mode)` fire-and-forget POSTs
`{type: 'chat/${mode}', request_id, content}` (an omitted mode takes the composer's current mode,
`tell` only until the visitor switches); the reply arrives over SSE as
`chat/delta` fragments that **accumulate**, then a final `chat/response` carrying the full text
**replaces** them, matched by `request_id`.

**Tool execution** — `ChatContext` dedupes `tool/call` by `tool_call_id`, executes `browser_tool` via
`browserToolService.executeTool` (an unknown name fails the call against its `tools` registry), then
replies `tool/response`.
`get_html` ships a clone of the **whole document** with **`data-id` added** to each indexed element —
that added attribute is the entire contract with the agent's HTML parser, which reads no geometry and
keeps only selector, tag and a truncated label, so the markup itself never reaches a prompt. The
snapshot is neither stripped nor size-capped, unlike `extract`, which truncates at 10k: the parser
indexes by `data-id`, and a trimmed tree silently loses elements the loop then cannot click.
The `finish` tool (`FINISH_TOOL`, labelled Done) ends the task. **The first `tool/call` is what activates the task**, not
`task/status running` — the api mints no task id, so the widget holds none and `chat/stop` carries none;
the terminal three clear the task and the dedupe set.

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
  re-execution and dedupes init; the module-level `initPromise` coalesces concurrent `initWidget` calls
  onto one in-flight init and is cleared when it settles.
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

**One config, one store, read from context.** `WidgetRoot` is the only component that touches the
raw config prop — it persists it and publishes the resolved config (position and z-index
layered on) through `WidgetConfigContext`, plus its own root element through `PortalContainerContext`.
Everything below calls `useWidgetConfig()` for settings and `useWidget()` for the store; **never thread
either down as props.** The widget is open or closed — there is no minimized panel.

`src/index.tsx` (public entry — see `README.md` for the customer surface) · `src/services/` (stateful
runtime owners: `StreamClient`, `RrwebSessionRecorder`, `BrowserToolService`, `ShowModeService`,
`DomService`, `ChatService`, `ChatSessionManager`, `StorageService`,
`ScreenShareService`, plus stateless functions) · `src/components/` (`Surface` is the canonical
container primitive; `WidgetDialog` the one specialized modal;
`src/design-system/semantic-tokens.ts` owns settings-to-token adaptation and
`component-tokens.ts` every fixed token — radius, text, shadow, layer) · `src/context/`
(`ChatContext` is one store `{messages, task}`, plus `UIStateContext`, `sseReducer`) · `src/test/` +
colocated `*.test.ts(x)`.

## Release & CI

`bun run tag <version>` bumps `package.json`, refreshes `bun.lock`, builds, commits and
creates the annotated tag. Pushing `v*` independently fires the repo-local `image.yml` →
`marketrix.azurecr.io/widget:<version>` (**v-prefix stripped**) and `publish.yml` → npm. This public
repo cannot call Infra's private reusable image workflow, so its local build stays equivalent;
publication remains separate and skips an existing npm version. `ci.yml` runs only for pull requests
and pushes to `main`. Root `../CLAUDE.md` carries the full release order.

Docker: one file, stages `base` → `dev` / `builder` → `runtime` (bun build → nginx serve, mime patched
to serve `.mjs`; the `runtime` stage's nginx base carries no bun/node, only the built static assets).
Tilt builds `dev`, CI builds `runtime`, both inheriting `base`'s `bun install --frozen-lockfile`, so
local and shipped images cannot drift in their dependency set.

## Gotchas

- **Lockfile discipline** — any version or dependency change must run `bun install` and commit
  `bun.lock` alongside `package.json`. `bun run tag` does it for you.
- **The loader always injects its `esm.sh` React importmap** — it neither reads nor merges an existing
  one. A host importmap placed before the loader keeps its entries because browsers never let a later
  import map override an earlier key, so the loader's map only fills what the host left out.
- **Styling is `index.css` plus inline styles — there is no CSS framework and no `cn()`.** Layout
  props resolve to a style object (`resolveLayoutStyle`), never class names: as classes they were
  interpolated, so a build-time safelist was the only thing keeping them alive and a missing entry
  failed silently at runtime. Variants are CSS keyed on the `data-*` attributes the components emit
  (`data-variant`/`data-size`/`data-active`/`data-disabled`/`data-stacked`/`data-full`/`data-tone`), which is also
  why `bare` and `tab` can simply not have padding rather than needing a merge pass to undo it.
  A new `animate` token needs a matching `@keyframes` — `stylesheet-contract.test.ts` pins that.
- **The widget stays quiet on a customer's console.** There is no `console.log`/`console.info` in `src/`:
  terser drops `log`/`info`/`debug`, so such a line only ever reaches a developer running the dev server,
  and it reads in review like shipped telemetry. Severity follows the root `../CLAUDE.md` — a
  degraded-but-handled failure (a reconnect, unreadable `localStorage`, dropped telemetry) is `warn`, an
  unexpected one is `error`, and each failure logs exactly one record.
- **The widget has no dark mode** — no `.dark` block, no `dark:` variant. Theming is the per-tenant
  settings → CSS custom properties in `semantic-tokens.ts`, nothing else.
- **Elevation is a `SHADOW.*` token** (`design-system/component-tokens.ts`), applied inline through `Surface`'s
  `elevation` prop / `getElevationStyle` — **there is no settings-driven shadow**; the four
  settings that reached nothing here (`widget_device`, `widget_bounce_effect`, `widget_shadow`,
  `widget_feature_human`) were dropped from the contract in db-V247. `widget_appearance` is
  `default | hidden` — `compact`/`full` were retired in db-V246 because this widget rendered them
  identically to `default`.
- **A portal must land inside `[data-marketrix-widget]`** — that element carries every tenant token as
  an inline style, so anything portaled to the shadow root instead falls back to `index.css`'s hardcoded
  palette. `WidgetRoot` publishes its own root through `PortalContainerContext` for exactly that.
- **`marketrix_widget_position_<tenant>` is written only by a drag** — seeding it with
  `config.widget_position` would pin the dashboard's setting at whatever it was on a visitor's first load.
- **Inside a closed shadow root, `document.activeElement` is the HOST** and a stylesheet's `:root`
  matches nothing — read focus through `getRootNode()`, and scope host-level rules to `:host` or
  `[data-marketrix-widget]`. `useFocusTrap.activeElementIn` is the one home for the retargeting and
  eslint's `no-restricted-properties` bans the bare read everywhere else. **Base UI has the same bug
  and cannot see it**: its focus restore descends `element.shadowRoot.activeElement`, which is null for
  a closed root, so it records the host and hands focus to the host page on close — `WidgetDialog`
  passes an explicit `finalFocus` ref rather than relying on the default.
- **Base UI owns the interaction primitives; the two remaining hand-rolled hooks are not a gap.**
  Dialog, Button, Tabs (`ShellTabBar` + the view panels) and Toast (`Notifications.tsx`) come from the
  library. `useFocusTrap` (in `MessengerShell`) and `useScrollLock` (in `WidgetRoot`) stay hand-rolled
  because they serve a **non-modal** panel that is not a Dialog: Base UI exposes no standalone
  focus-trap or scroll-lock, and making the panel a Dialog to reach them would inert the customer's
  page and mutate its `<html>`/`<body>` — the thing an embedded widget must not do.

## Conventions

TS, 2-space indent, single quotes, semicolons, trailing commas, ~120-char lines; `type` imports, sorted
imports, no unused imports. `PascalCase` components/services/context, `useCamelCase` hooks, `camelCase`
utils. **Keep stateful services only for shared lifecycle/session ownership** — use plain functions for
stateless operations, and inline one-use presentation rather than adding a base component.

## Field notes

Standing gotchas folded in from session memory so they travel with the repo. Every bullet is a live invariant or trap; delete one when the code it describes is gone.

### Gotchas

- **A green `publish` job never proves a publish** — the step is idempotent (`bun publish --tolerate-republish` exits 0 on an already-published version), and a skipped publish leaves npm behind the tag so app's `npm install @marketrix.ai/widget@<ver>` fails. Check `npm view @marketrix.ai/widget version` before pinning app. Publishing from a tag cut off stale local `main` ships `latest` without the fix and burns the version number.
- Diff the BUILT artefact, not just source: an `@layer utilities` block not migrated to Tailwind v4's `@utility` compiles `hover:`/`placeholder:` variants to NOTHING with no error, and over half of `index.css` was once unreachable that way. The prod bundle drops `console.*` (terser) — debug via api/agent logs.
- **The contract gate checks the widget version the app BUNDLES**, not the widget image — a types-only mirror change still needs: tag widget → wait for npm → `npm install @marketrix.ai/widget@<ver>` in app → commit lockfile → tag app.
