# Repository Guidelines

## Task Completion Requirements

- For most changes, `npm run code:check`, `npm run test:run`, and `npm run build` must pass before handoff.
- If you touch rendered UI, packaging, or release artifacts, also run `npm run visual:check`, `npm run a11y:check`, and `npm run bundle:check`.
- Git hooks run `npm run check` and autofixing lint on commit. Treat hooks as a safety net, not the only validation step.

## Project Snapshot

Marketrix Widget is an embeddable React/Vite support widget shipped as a library bundle (`dist/widget.mjs`) plus a script-tag loader (`public/loader.js`, copied into builds). It runs inside arbitrary host pages, so host compatibility, predictable runtime behavior, and controlled bundle size matter as much as feature work.

## Core Priorities

1. Host-page safety first. Avoid global DOM or CSS leakage and preserve the closed Shadow DOM bootstrap model in `src/utils/bootstrap.tsx`.
2. Reliability first. Be careful with session lifecycle, stream reconnects, chat state, and recorder concurrency in `src/services/`.
3. UI quality first. Keep accessibility, responsive behavior, and design-token usage consistent across `src/components/` and `src/design-system/`.

## Project Structure & Module Roles

- `src/components/`: widget UI, including `base/`, `blocks/`, `chat/`, `navigation/`, `ui/`, and `views/`.
- `src/services/`: API, stream, session, DOM, recording, and widget orchestration logic.
- `src/hooks/`, `src/context/`, `src/utils/`, `src/lib/`: reusable client state and shared helpers.
- `src/sdk/`: typed API contracts and schemas; update deliberately and keep changes aligned with backend behavior.
- `src/test/` and `src/**/__tests__/`: Vitest setup, fixtures, accessibility helpers, and feature tests.
- `public/`: static loader assets. `dist/`: generated output only; do not edit by hand.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation, single quotes, semicolons, trailing commas, and a 120-character line target. Prefer `type` imports, keep imports sorted, and extract shared logic instead of duplicating behavior across components or services. Follow existing naming: `PascalCase` for components, services, and context files, `useCamelCase` for hooks, and `camelCase` for utility modules.

## Testing, Commits & Pull Requests

Vitest runs in `jsdom` with Testing Library, `@testing-library/jest-dom`, and axe-based accessibility helpers. Name tests `*.test.ts` or `*.test.tsx` and keep them near the feature under test; keep snapshots in adjacent `__snapshots__/` folders. Recent history follows Conventional Commit style such as `fix(scope): ...` and `chore(widget): release v3.2.183`. PRs should use `.github/pull_request_template.md`, link issues, summarize behavior changes, list validation performed, and include screenshots for visible UI updates.
