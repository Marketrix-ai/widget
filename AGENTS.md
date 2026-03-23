# Repository Guidelines

## Task Completion Requirements

- For most changes, `npm run code:check`, `npm run test:run`, and `npm run build` must pass before handoff.
- If you touch rendered UI, packaging, or release artifacts, also run `npm run visual:check`, `npm run a11y:check`, and `npm run bundle:check`.
- Git hooks run type-check and autofixing lint; do not rely on hooks alone.

## Project Snapshot

Marketrix Widget is an embeddable support widget built with TypeScript 5.9, React 19, Vite, Tailwind CSS 4, Zod, and oRPC. It ships as `dist/widget.mjs` plus a script-tag loader. Because it runs inside arbitrary host pages, host compatibility, predictable runtime behavior, and controlled bundle size are first-class concerns.

## Core Priorities

1. Host-page safety first. Avoid global DOM or CSS leakage and preserve the closed Shadow DOM bootstrap model in `src/utils/bootstrap.tsx`.
2. Reliability first. Be careful with session lifecycle, stream reconnects, chat state, and recorder concurrency in `src/services/`.
3. UI quality first. Keep accessibility, responsive behavior, and design-token usage consistent across `src/components/` and `src/design-system/`.

## Runtime Model
- Production mode uses `mtxId` + `mtxKey`, dev mode uses `mtxApp` + `mtxAgent`, and preview mode renders through `MarketrixWidget`.
- The widget mounts in a closed Shadow DOM, uses `window.__mtx` as a singleton guard, and talks to the API through typed SSE (`widgetStream`) plus typed POST commands (`widgetMessage`).

## Project Structure & Module Roles

- `src/components/`: widget UI, including `base/`, `blocks/`, `chat/`, `navigation/`, `ui/`, and `views/`.
- `src/services/`: API, stream, session, DOM, recording, and widget orchestration logic.
- `src/hooks/`, `src/context/`, `src/utils/`, `src/lib/`: reusable client state and shared helpers.
- `src/sdk/`: typed API contracts and schemas; `src/sdk/routes.ts` and `src/sdk/schema.ts` must stay aligned with the API-side contract.
- `src/test/` and `src/**/__tests__/`: test setup, fixtures, accessibility helpers, and feature tests.
- `public/`: static loader assets. `dist/`: generated output only.

## Critical Integration Points
- `src/sdk/index.ts`: oRPC client wrapper with dynamic `configureSdk()` behavior.
- `src/services/StreamClient.ts`: SSE lifecycle, registration, auth failure handling, and exponential backoff reconnects.
- `src/services/SessionRecorder.ts`: rrweb batching and POST flush behavior. Preserve the current 500 ms / 50 KB flush thresholds and 500 KB batch cap unless you intentionally change API expectations.
- `src/utils/bootstrap.tsx`: container creation, closed Shadow DOM mounting, and singleton lifecycle rules.

## Development Rules
- Do not develop directly on `dev`; use a feature branch or worktree.
- Treat issues or PR descriptions as the source of truth for scope, then verify the implementation matches before handoff.
- Keep `src/sdk/routes.ts` and `src/sdk/schema.ts` synchronized with backend contract changes in the API repo.
- Prefer extending shared services or utilities over adding one-off logic in a single component.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation, single quotes, semicolons, trailing commas, and a 120-character line target. Prefer `type` imports, keep imports sorted, and extract shared logic instead of duplicating behavior. Follow existing naming: `PascalCase` for components, services, and context files, `useCamelCase` for hooks, and `camelCase` for utility modules.

## Testing, Commits & Pull Requests

Vitest runs in `jsdom` with Testing Library, `@testing-library/jest-dom`, and axe helpers. Name tests `*.test.ts` or `*.test.tsx` and keep them near the feature under test. For stream or session changes, add tests for reconnects, persistence, or event handling, not just render output. Recent history follows Conventional Commit style such as `fix(scope): ...` and `chore(widget): release v3.2.183`. PRs should use `.github/pull_request_template.md`, link issues, summarize behavior changes, list validation performed, and include screenshots for visible UI updates.
