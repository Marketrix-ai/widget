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
bun run type-check       # tsc --noEmit         bun run lint    # --fix, max-warnings 0
bun run test             # bun test (jsdom preload + Testing Library + axe-core)
bun run test:watch       # bun test --watch
bun run test:coverage    # bun test --coverage
bun run bundle:check     # packaging gate (size, single chunk, no CSS file, React external)
bun run check:served     # asserts what the nginx runtime image actually SENDS, over real HTTP
bun run code:check       # tsc + eslint + prettier --check (one-shot)
bun run ci               # every CI validation gate
bun run tag <version>    # infra/scripts/release.sh
```

**Tests run on `bun test`, not vitest** (pinned by sourceInvariants.test.ts). `src/test/preload.ts` (the
`bunfig.toml` `[test] preload`) is the sole DOM bootstrap:
a hand-installed jsdom `Window`, with `window` made self-referential to `globalThis` (matching a real
browser's top frame and vitest's own jsdom environment) so tests that redefine `window.location` via
`Object.defineProperty` keep working despite jsdom's own `Window.prototype.location` being
non-configurable. `src/test/vi-compat.ts` is the one home for the handful of `vi.*` helpers bun's
`vitest`-compat shim doesn't implement (`mocked`, `hoisted`, `advanceTimersByTimeAsync`, `waitFor`,
`restoreModuleAfterAll`) — reach for it before hand-rolling another one-off shim. Unlike vitest, plain
`bun test` runs every file in ONE process/global object, so a `vi.mock`/`vi.spyOn`/module-level
singleton state from one file can leak into another purely by file-discovery order, sometimes only on
CI's Linux runner. **`bun test` always runs with `--isolate`**, closing that class at the runner level (pinned
by sourceInvariants.test.ts); keep any new mock/spy scoped to its own file regardless, and don't remove
the flag to "speed up" a run. Filter a run with `bun test <pattern>`;
a single file with `bun test path/to/file.test.ts`.

**`src/__tests__/embedSmoke.test.ts` is the only test that boots the BUILT `dist/widget.mjs`** in a jsdom host
document via the documented `script[mtx-id]` attributes, pinning the closed-shadow mount, the FAB's
z-index, the runtime export surface and that no request fires before the deferred auto-init tick or
without a host script tag. `bun run ci` runs `build` BEFORE `test` (never spawns a build from inside a
test — that blew past `bun test`'s per-test timeout in CI); the test only asserts `dist/widget.mjs`
exists and fails with a clear message under a standalone `bun test`.

**Comment gate** — `scripts/check-comments.ts` (`bun run check:comments`, wired into `ci` before
`build`) enforces Rule 0: zero inline comments outside the one top docstring, capped at 12 lines. It
tokenizes with the real TypeScript scanner rather than a naive regex, so a `//`/`/*` inside a string,
regex or template literal is never mistaken for a comment.

**bun test has no `vi.resetModules`** — an ES import is cached forever by resolved specifier, so a
test needing a fresh module evaluation (or one dodging a `vi.mock` left active by an earlier file)
bumps the specifier itself: a `?t=<n>` query for a fresh eval, or the `?real`-suffixed import
`restoreModuleAfterAll` uses to bypass a live mock. A `.mjs` import is cached by PATH ONLY, ignoring
the query string (unlike bun's own `.ts` transpile loader) — a cache-buster only works on `.ts`/`.tsx`.
jsdom does no layout: `offsetParent` is always null, `innerText` and `isContentEditable` are
unimplemented, and `document.currentScript` is a non-configurable getter `spyOn` cannot stub (shadow
it as an own property instead) — any focus-order, visibility or DOM-manipulation test must stub these
directly rather than relying on jsdom to compute them. Bun's `it.each` mistakes a bare `[]` entry for
zero arguments and hangs on the sole declared parameter (mistaken for a `done` callback) — wrap a
no-argument case as `[[]]`.

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

- `main`/`module` = `./dist/widget.mjs`, `types` = `./dist/src/index.d.ts`. The published `files`
  allowlist and the absence of `.npmignore` are pinned by sourceInvariants.test.ts. The map is built but
  never published; `sourcemap: 'hidden'` keeps the bundle from advertising one it does not ship.
- Vite lib mode: `formats: ['es']`, no CSS splitting, target `esnext`, terser with `drop_console`.
  **`codeSplitting: false` belongs on `rolldownOptions.output`** — Vite never reads it from `build`.
- **CSS is injected via JS** — no external stylesheet; it rides in the bundle and is mounted into the
  Shadow DOM from `index.css?inline`.
- **Externals** (resolved via the host importmap) are the four React entry points (pinned by
  sourceInvariants.test.ts).
- Declarations come from a custom `closeBundle` plugin running `tsc -p tsconfig.build.json`.
- `public/loader.js` → `dist/loader.js` is the classic script-tag bootstrap.
- **The runtime image serves an allowlist, not `dist/`.** The Dockerfile names each served file, so
  the sourcemap (which embeds the whole source) and the `.d.ts` tree stay unpublished; a new served
  artifact must be added there by hand. `widget.mjs.gz`/`.br` are precompressed in the builder stage
  by `scripts/precompress.ts` (the one home for the gzip/brotli params, reused by `check:served`'s
  no-docker fallback), and nginx has no brotli module — `gzip_static` covers gzip, a `try_files` on
  `Accept-Encoding` covers brotli. Nothing is compressed per request.
- **`bundle:check` budgets each bundled dependency, not just the total** — a total cap cannot see
  which dependency grew. Two are about half of it: `@base-ui/react` + `/utils` and `@rrweb/record`
  (a feature off by default), each named in `DEPENDENCY_BUDGETS` (pinned by sourceInvariants.test.ts);
  a package missing from it fails the gate, so a new import is a deliberate line.
- **zod ships in the bundle, so untrusted input is parsed with the contract's own schemas** — rrweb
  events via `RrwebEventSchema`, settings via `parseWidgetSettings` in `services/WidgetService.ts` —
  never with a hand-written guard that re-spells a contract shape.
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

Both payloads are Zod **discriminated unions on `type`**, whose literal sets are exercised via real
`safeParse` calls in `src/services/__tests__/sse-event-handling.test.ts`: `WidgetEvent` — `registered`, `heartbeat`, `chat/response`, `chat/delta`,
`chat/error`, `task/status`, `tool/call`. `WidgetCommand` — `chat/tell`, `chat/show`, `chat/do`,
`chat/stop`, `tool/response`, `rrweb/metadata`, `rrweb/events`.

**Transport** — `src/services/StreamClient.ts` is a singleton wrapping the oRPC `sdk`, draining the
async iterator in the background. Status machine `disconnected → connecting → open → registered`, plus
`error` from any failed connect or stream — **`open` is the transport, `registered` is the chat**, so
`isConnected()` reads `registered` and nothing waits on `open`. Exponential-backoff reconnect (1000ms
×2, cap 30000ms, **max 10 attempts**; counters reset on `registered` and on a manual `reconnectNow`) and the `chat/error`
`request_id === 'auth'` give-up branch are exercised with real fake-timer tests in
`StreamClient.test.ts`, not a source-text pin. **A reconnect gets a
fresh, empty queue, never a replay** — the api keeps a chat_id's turn history only to fold back into the
agent's prompt on the next dispatch (Tell/Show/Do stay one thread), so a dropped stream sees only the
future events of a still-in-flight dispatch, never anything already delivered or missed; the widget
still dedupes a resent `tool/call` by `tool_call_id` (the agent can genuinely resend one), but not
`chat/delta`/`chat/response`, since the api never redelivers those. It accepts a command only into a
chat whose stream has reached `registered`. SSE is additionally keyed server-side by `(chat_id, tab_id)`
so several tabs
sharing one `chat_id` don't evict each other's stream.

**Stop** — `ChatContext.stopTask` is the one stop path (composer and launcher): it cancels a Show step
still waiting on the visitor, and a cancelled step posts no `tool/response`.

**Round-trip** — `ChatContext.sendTurn(content, mode)` is the one entry for a typed turn or a chip: Show
and Do wait behind a screen-access request unless a share is live or `use_screenshare` is off, then it
POSTs `{type: 'chat/${mode}', request_id, content}`; the reply arrives over SSE as
`chat/delta` fragments that **accumulate**, then a final `chat/response` carrying the full text
**replaces** them, matched by `request_id`.

**Tool execution** — `ChatContext` dedupes `tool/call` by `tool_call_id`, executes `browser_tool` via
`browserToolService.executeTool`, then replies `tool/response`. The `tools` registry is keyed by the
contract's tool names and typed from the contract's per-tool args, so a tool the contract adds fails tsc
until it has a handler — never re-type tool args by hand.
`get_html` ships a clone of the **whole document** with **`data-id` added** to each indexed element —
that added attribute is the entire contract with the agent's HTML parser, which reads no geometry and
keeps only selector, tag and a truncated label, so the markup itself never reaches a prompt. The
snapshot is neither stripped nor size-capped, unlike `extract`, which truncates at 10k: the parser
indexes by `data-id`, and a trimmed tree silently loses elements the loop then cannot click.
The `done` tool ends the task, stamped done or failed by its `success` arg. **The first `tool/call` is what activates the task**, not
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
  onto one in-flight init and is cleared when it settles. The union type is the only guard against a
  third state value (tsc rejects an untyped literal at the assignment site); `embedSmoke.test.ts` covers
  the real init/leak behavior.
- **Closed Shadow DOM** (`attachShadow({ mode: 'closed' })`, exercised for real by `embedSmoke.test.ts`):
  the host cannot reach into the widget DOM, intentionally — don't expect host scripts or CSS to style or
  query inside it.
- **The runtime API host is not an env var** — it is supplied per-init as the required `mtxApiHost`
  (config) / `mtx-api-host` (script attr), and `configureSdk(apiUrl)` rebuilds the oRPC client. There is
  no baked-in API URL: an init without one fails with a host-page notice rather than posting widget
  traffic at the host page's own origin.
- **`widgetPublicSearch`'s response never carries a credential** — only `application_id`/
  `widget_settings`, never the `marketrix_id`/`marketrix_key` pair the call authenticated with, nor a
  rendered embed snippet, and no `status`: the api only ever returns a row for a live `marketrix_id`, so a
  returned widget is unconditionally active.

## SDK mirror (generated)

`src/sdk/contract.ts` + `contracts/*` are a **generated scoped mirror** of the api's widget audience —
**never hand-edit; regenerate from the api side.** `src/sdk/index.ts` is hand-written (the `sdk` proxy,
`configureSdk`, wire-type re-exports). There is **no `routes.ts` and no `schema.ts`** (checked by
`src/__tests__/sdk-mirror-invariants.test.ts`).

Drift is enforced in **infra**, at the api tag this widget is pinned beside. **Widget gets a second
check the other consumers don't need**: `app` bundles this package **from npm at whatever its own
lockfile pins**, which is not the widget image tag deployed beside it, and `publish` runs at tag push
with no gate in front of it — so infra also checks the mirror of the widget version `app` actually
bundles, i.e. the build a browser really loads.

## Structure

**One config, one store, read from context.** `mount.tsx` holds the one live config and hands it to
`WidgetProviders`, which publishes it through `WidgetConfigContext`; `WidgetRoot` re-publishes it with
the dragged position and z-index floor layered on, plus its own root element through
`PortalContainerContext`. Everything below calls `useWidgetConfig()` for settings and `useWidget()` for the
store; **never thread either down as props.** Config and credentials are never persisted — `StorageService`
holds only the transcript, and the stream's credentials live on `streamClient`. The screen-share state is
the `ScreenShareService` store, read with `useSyncExternalStore`, never mirrored into component state.
The widget is open or closed — there is no minimized panel.

**`src/hooks/` holds only a hook with 2+ consumers** (pinned by sourceInvariants.test.ts). A
single-consumer hook lives beside its one caller instead, exported for its `renderHook` tests — rule
6/7's file-flattening applied to hooks.

## Release & CI

`bun run tag <version>` bumps `package.json`, proves `bun.lock` with `--frozen-lockfile`, builds, commits
and creates the annotated tag. Pushing `v*` independently fires the repo-local `image.yml` →
`marketrix.azurecr.io/widget:<version>` (**v-prefix stripped**) and `publish.yml` → npm. This public
repo cannot call Infra's private reusable image workflow, so its local build stays equivalent;
publication remains separate and skips an existing npm version. `ci.yml` runs only for pull requests
and pushes to `main`. Root `../CLAUDE.md` carries the full release order.

Docker: one file, stages `base` → `dev` / `builder` → `runtime` (bun build → nginx serve, mime patched
to serve `.mjs`; the `runtime` stage's nginx base carries no bun/node, only the built static assets).
Tilt builds `dev`, CI builds `runtime`, both inheriting `base`'s `bun install --frozen-lockfile`, so
local and shipped images cannot drift in their dependency set.

**`check:served` boots that exact `runtime` image via docker when it's on `PATH`** (falling back to a
`Bun.serve` static server re-deriving `nginx.conf`'s own header/negotiation rules when it isn't) and
asserts headers, CORS, compression negotiation and a 404 over real HTTP — never a second hardcoded
header table. `TARGET_URL=https://widget.marketrix.ai bun run check:served` runs
the identical rows against a deployed host; adding `EXPECTED_TAG=<version>` to that also asserts
`/widget.mjs` is byte-identical to a source build of that tag — read the tag from infra's Helm values
or the `deploy.yml` dispatch inputs (this repo cannot reach the private infra repo to read it itself).

## Gotchas

- **Lockfile discipline** — any dependency change must run `bun install` and commit `bun.lock` alongside
  `package.json`; `bun run tag` refuses a stale lockfile rather than refreshing it.
- **The loader always injects its `esm.sh` React importmap** — it neither reads nor merges an existing
  one. A host importmap placed before the loader keeps its entries because browsers never let a later
  import map override an earlier key, so the loader's map only fills what the host left out.
- **Styling is `index.css` plus inline styles — there is no CSS framework (pinned by
  sourceInvariants.test.ts) and no `cn()` (eslint-banned via `no-restricted-syntax`)**. Layout props resolve to a style object (`resolveLayoutStyle`), never class
  names: as classes they were interpolated, so a build-time safelist was the only thing keeping them
  alive and a missing entry failed silently at runtime. Variants are CSS keyed on the `data-*`
  attributes the components emit (`data-variant`/`data-size`/`data-active`/`data-disabled`/`data-stacked`/`data-full`/`data-tone`),
  which is also why `bare` and `tab` can simply not have padding rather than needing a merge pass to
  undo it. A new `animate` token needs a matching `@keyframes` — `stylesheet-contract.test.ts` pins that.
- **The widget stays quiet on a customer's console** — no `console.log`/`info`/`debug` in `src/` (terser
  drops them, so such a line only ever reaches a developer running the dev server) and every warn routes
  through **`utils/log.ts`'s `logWarn`**, never a bare `console.warn` (eslint's `no-console` allows only
  `error` everywhere, plus `warn` in `log.ts` alone). Severity follows the root `../CLAUDE.md` — a degraded-but-handled failure
  (a reconnect, unreadable `localStorage`, dropped telemetry) is `warn`, an unexpected one is `error`;
  `logWarn` prints only the cause's message, never the raw `Error`, because attaching a stacktrace is
  what promotes a record to `error` — call `console.error` directly where the whole object belongs.
- **The widget has no dark mode** — no `.dark` block, no `dark:` variant (pinned by
  sourceInvariants.test.ts). Theming is the per-tenant settings → CSS custom properties in
  `semantic-tokens.ts`, nothing else.
- **Elevation is a `SHADOW.*` token** (`design-system/component-tokens.ts`), applied inline through `Surface`'s
  `elevation` prop / `getElevationStyle` — **there is no settings-driven shadow**; the
  settings type has no shadow, device or bounce field, and `widget_appearance` is `default | hidden`.
- **A portal must land inside `[data-marketrix-widget]`** — that element carries every tenant token as
  an inline style, so anything portaled to the shadow root instead falls back to `index.css`'s hardcoded
  palette. `WidgetRoot` publishes its own root through `PortalContainerContext` for exactly that.
- **`marketrix_widget_position_<tenant>` is written only by a drag** — seeding it with
  `config.widget_position` would pin the dashboard's setting at whatever it was on a visitor's first load.
- **Inside a closed shadow root, `document.activeElement` is the HOST** and a stylesheet's `:root`
  matches nothing — read focus through `getRootNode()`, and scope host-level rules to `:host` or
  `[data-marketrix-widget]`. `activeElementIn`, a module-private helper next to `useFocusTrap` in
  `MessengerShell.tsx`, is the one home for the retargeting and eslint's `no-restricted-properties` bans
  the bare read everywhere else (enforced by eslint, not a duplicate test). **Base UI has the same bug and
  cannot see it**: its focus restore
  descends `element.shadowRoot.activeElement`, which is null for a closed root, so it records the host
  and hands focus to the host page on close — `ScreenAccessDialog` passes an explicit `finalFocus` ref rather
  than relying on the default.
- **Base UI owns the interaction primitives; the remaining hand-rolled hooks are not a gap.** Dialog,
  Button, Tabs (`ShellTabBar` + the view panels) and Toast (`Notifications.tsx`) come from the library.
  `useFocusTrap` and `useResize` (both in `MessengerShell.tsx`), `useScrollLock` (in `WidgetRoot.tsx`) and
  `useDragSnap` (in `WidgetFab.tsx`) live beside their one consumer rather than in `src/hooks/`, which
  holds only `useWidget`. `useDragSnap`/`useResize` share a control-flow shape, not code; a shared
  pointer-tracking hook does not pay for its arity.
  `useFocusTrap`/`useScrollLock` stay hand-rolled because they serve a **non-modal** panel that is not a
  Dialog: Base UI exposes no standalone focus-trap or scroll-lock, and making the panel a Dialog to
  reach them would inert the customer's page and mutate its `<html>`/`<body>` — the thing an embedded
  widget must not do.

## Conventions

Formatting and import order are prettier/eslint-enforced, not a convention to remember. `PascalCase`
components/services/context, `useCamelCase` hooks, `camelCase` utils. **Keep stateful services only for
shared lifecycle/session ownership** — use plain functions for stateless operations, and inline one-use
presentation rather than adding a base component.

## Field notes

Standing gotchas folded in from session memory so they travel with the repo. Every bullet is a live invariant or trap; delete one when the code it describes is gone.

### Gotchas

- **A green `publish` job never proves a publish** — the step is idempotent (`bun publish --tolerate-republish` exits 0 on an already-published version), and a skipped publish leaves npm behind the tag so app's `bun add @marketrix.ai/widget@<ver>` fails. Check `npm view @marketrix.ai/widget version` before pinning app. Publishing from a tag cut off stale local `main` ships `latest` without the fix and burns the version number.
- Diff the BUILT artefact, not just source: the prod bundle drops `console.*` (terser), so a debug line that looks present in `src/` is gone at runtime — debug via api/agent logs instead.
- **`localStorage` is eslint-banned (`no-restricted-globals`) everywhere except `StorageService.ts`** — a
  bare `localStorage.getItem`/`setItem` elsewhere is a lint error, and every stored value is JSON read
  back through `readLocalParsed(key, schema)`.
- **The contract gate checks the widget version the app BUNDLES**, not the widget image — a types-only mirror change still needs: tag widget → wait for npm → `bun add @marketrix.ai/widget@<ver>` in app → commit `bun.lock` → tag app.
