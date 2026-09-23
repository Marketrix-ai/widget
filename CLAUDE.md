# Widget

Embeddable customer-support widget hosts drop into their own product via a script tag or npm
(`@marketrix.ai/widget`). It runs inside **arbitrary host pages**, so host isolation, a predictable
runtime and bundle size are first-class concerns. ESM-only single bundle `dist/widget.mjs`, mounted into
a **closed Shadow DOM** with all CSS injected as JS; **React 19 is a peer dependency, external to the
bundle — the host page supplies it.**

**`README.md` is the public API surface** — customer-facing integration docs; keep it accurate. The root
`../CLAUDE.md` owns cross-cutting rules (widget↔api contract, status vocabulary, contract sync, release).

## Commands

```bash
bun start                # vite dev on :9001 (override PORT / VITE_PORT)
bun run build            # dist/widget.mjs + declarations
bun run test             # bun test; filter with `bun test <pattern>`
bun run bundle:check     # packaging gate (size, per-dependency budgets, single chunk, React external)
bun run check:served     # asserts what the nginx runtime image actually sends, over real HTTP
bun run code:check       # tsc + eslint + prettier --check
bun run ci               # every CI gate — the pre-handoff gate
bun run tag <version>    # release: bump, prove bun.lock, build, commit, annotated tag
```

`TARGET_URL=https://widget.marketrix.ai [EXPECTED_TAG=<version>] bun run check:served` runs the same rows
against a deployed host; `EXPECTED_TAG` also asserts `/widget.mjs` is byte-identical to a source build of
that tag (read the tag from infra's Helm values — this public repo cannot reach infra).

## Testing (bun test, not vitest)

- **`bun test` always runs with `--isolate`** — plain bun runs every file in one global object, so a mock
  or singleton leaks across files by discovery order. Never drop the flag; keep mocks file-scoped anyway.
- `src/test/preload.ts` is the sole DOM bootstrap (jsdom, `window === globalThis`). `src/test/vi-compat.ts`
  is the one home for `vi.*` helpers bun lacks — extend it rather than hand-rolling a shim.
- **No `vi.resetModules`**: bump the specifier (`?t=<n>`, or the `?real` import `restoreModuleAfterAll`
  uses). A `.mjs` import is cached by path only — cache-busting works only on `.ts`/`.tsx`.
- jsdom does no layout: `offsetParent` is null, `innerText`/`isContentEditable` are missing, and
  `document.currentScript` cannot be `spyOn`-stubbed (shadow it as an own property). Stub them directly.
- Bun's `it.each` hangs on a bare `[]` entry — wrap a no-argument case as `[[]]`.
- `embedSmoke.test.ts` is the only test that boots the **built** `dist/widget.mjs`; `ci` builds before
  testing, and a test never spawns a build (it blew `bun test`'s timeout).
- `check:comments` enforces Rule 0 with the TypeScript scanner, so a `//` inside a string is not a comment.

## Hooks

`lefthook` installs itself on `bun install` (skipped when `CI` is set). A global `core.hooksPath` hijacks
the target and unscopes the hook to every repo. The shim sources `.lefthookrc` to put bun on `PATH` for
GUI clients; that path is baked in at install, so after changing `rc:` re-run `lefthook install --force`.

## Packaging

- **`codeSplitting: false` belongs on `rolldownOptions.output`** — Vite never reads it from `build`.
- **A single chunk makes every import unconditional** — a heavy dependency behind an off-by-default flag
  still ships to every host page. `bundle:check` budgets each bundled dependency in `DEPENDENCY_BUDGETS`;
  an unlisted package fails the gate, so a new import is a deliberate line.
- **The runtime image serves an allowlist, not `dist/`** — the sourcemap (the whole source) and `.d.ts`
  stay unpublished, and a new served file is added to the Dockerfile by hand. `.gz`/`.br` are precompressed
  at build by `scripts/precompress.ts`; nginx has no brotli module, so brotli rides a `try_files`.
- **zod ships in the bundle, so untrusted input is parsed with the contract's own schemas** (rrweb events,
  `parseWidgetSettings`), never a hand-written guard re-spelling a contract shape.
- `public/loader.js` is the script-tag bootstrap. **It always injects its `esm.sh` React importmap** without
  reading an existing one; a host map placed earlier keeps its keys, since a later map never overrides one.

## Widget ↔ api

Two oRPC procedures in `src/sdk/contracts/widget.ts`: `widgetStream` (SSE, server → widget) and
`widgetMessagePost` (POST, widget → server), each a Zod union discriminated on `type`.

- **`application_id` is deliberately NOT a stream input** — a guessable id as a credential let anyone
  drive any tenant's agent. It appears only on the `registered` event.
- **`open` is the transport, `registered` is the chat** — `isConnected()` reads `registered`, and a
  command is accepted only into a registered chat. Reconnect backs off exponentially, max 10 attempts, and
  gives up on a `chat/error` with `request_id === 'auth'`.
- **A reconnect gets a fresh, empty queue, never a replay.** The widget dedupes a resent `tool/call` by
  `tool_call_id` (the agent can resend one) but not `chat/delta`/`chat/response`, which are never
  redelivered. SSE is keyed server-side by `(chat_id, tab_id)` so tabs sharing a chat don't evict each other.
- `ChatContext.sendTurn` is the one entry for a turn or chip; `chat/delta` fragments **accumulate**, then
  `chat/response` **replaces** them by `request_id`. `stopTask` is the one stop path; a cancelled Show step
  posts no `tool/response`.
- **The first `tool/call` activates the task**, not `task/status running` — the api mints no task id, so
  `chat/stop` carries none. The `done` tool ends it, done or failed by its `success` arg.
- The `tools` registry is typed from the contract's per-tool args, so a new contract tool fails tsc until
  it has a handler — never re-type tool args by hand.
- **`get_html` ships the whole document with `data-id` added to each indexed element**, never stripped or
  size-capped: the agent's parser indexes by `data-id`, and a trimmed tree loses clickable elements.
- **Wire status** is `task/status.status ∈ {running, completed, failed, stopped, has_question}`.
  `ChatMessage.taskStatus` and `MessagePart.status` are UI-only — never conflate or widen them.
- `widget_recording` (off by default) gates rrweb batching. `widget_appearance: 'hidden'` hides host-page
  UI but still initializes; `widget_greeting_toast` controls only the toast.
- **`widgetPublicSearch` never returns a credential**, embed snippet or `status` — a returned row is live.

## Init & isolation

- `window.__mtx.state` (`initializing | active`) is the singleton guard across module re-execution;
  `initPromise` coalesces concurrent `initWidget` calls.
- **The API host is not an env var** — it is the required per-init `mtxApiHost` / `mtx-api-host`. An init
  without one fails with a host-page notice rather than posting to the host page's own origin.
- **Inside the closed shadow root, `document.activeElement` is the host** and `:root` matches nothing —
  read focus via `getRootNode()` (`activeElementIn` in `MessengerShell.tsx`; the bare read is eslint-banned)
  and scope rules to `:host` or `[data-marketrix-widget]`. Base UI's focus restore has the same bug, so
  `ScreenAccessDialog` passes an explicit `finalFocus`.
- **A portal must land inside `[data-marketrix-widget]`**, which carries the tenant tokens inline;
  `WidgetRoot` publishes it through `PortalContainerContext`.
- `useFocusTrap`/`useScrollLock` stay hand-rolled: the panel is non-modal, and making it a Base UI Dialog
  would inert the customer's page and mutate its `<html>`/`<body>`.

## State and styling

- **One config, one store, read from context** — `useWidgetConfig()` and `useWidget()`; never thread either
  down as props. Config and credentials are never persisted; `StorageService` holds only the transcript.
- **`localStorage` is eslint-banned outside `StorageService.ts`**; every value is read back through
  `readLocalParsed(key, schema)`.
- **`src/hooks/` holds only a hook with 2+ consumers**; a single-consumer hook lives beside its caller.
- `marketrix_widget_position_<tenant>` is written only by a drag — seeding it would pin the dashboard's
  setting at a visitor's first load.
- **Styling is `index.css` plus inline styles** — no CSS framework, no `cn()`, no dark mode. Layout props
  resolve to style objects (interpolated class names died silently without a safelist); variants key on
  `data-*` attributes; theming is tenant settings → CSS custom properties in `semantic-tokens.ts`; elevation
  is a `SHADOW.*` token, never a setting. A new `animate` token needs a matching `@keyframes`.
- **Quiet on the customer's console** — no `console.log/info/debug` (terser drops them anyway); warnings
  go through `utils/log.ts`'s `logWarn`, which prints only the message. Use `console.error` when the stack
  belongs.
- Keep stateful services only for shared lifecycle; stateless operations are plain functions.

## SDK mirror and release

- `src/sdk/contract.ts` + `contracts/*` are a **generated** mirror — never hand-edit. `src/sdk/index.ts` is
  hand-written.
- **The contract gate checks the widget version `app` bundles from npm**, not the widget image. A mirror
  change therefore needs: tag widget → confirm npm → `bun add @marketrix.ai/widget@<ver>` in app → commit
  `bun.lock` → tag app.
- **A green `publish` job never proves a publish** — it tolerates a republish. Check
  `npm view @marketrix.ai/widget version` before pinning app. Tagging from stale local `main` ships
  `latest` without the fix and burns the version.
- Pushing `v*` fires `image.yml` (`widget:<version>`, v-prefix stripped) and `publish.yml` separately. Any
  dependency change commits `bun.lock`; `bun run tag` refuses a stale lockfile.
- Debug the built artefact, not source: the prod bundle has no `console.*` — use api/agent logs.
