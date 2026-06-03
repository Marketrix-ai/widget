# Marketrix Widget

Embeddable support widget for Marketrix. Integrates into any website via script tag.

## Quick Start

```html
<script
  src="https://widget.marketrix.ai/loader.js"
  mtx-api-host="https://api.marketrix.ai"
  mtx-id="your-marketrix-id"
  mtx-key="your-marketrix-key"
></script>
```

## Configuration Options

### Script Attributes

| Attribute      | Type   | Required | Description                                       |
| -------------- | ------ | -------- | ------------------------------------------------- |
| `mtx-id`       | string | \*       | Your Marketrix ID (production mode)               |
| `mtx-key`      | string | \*       | Your Marketrix API key (production mode)          |
| `mtx-app`      | number | \*       | Application ID (dev mode)                         |
| `mtx-agent`    | number | \*       | Agent ID (dev mode)                               |
| `mtx-api-host` | string | yes      | API server URL (e.g., `https://api.marketrix.ai`) |

\*Either `mtx-id` + `mtx-key` (production) OR `mtx-app` + `mtx-agent` (dev) must be provided.

### Widget Settings

Widget appearance and behavior are configured through the API. Settings include position, colors, border radius, dimensions, enabled features, device visibility, header/body/greeting text, and quick-action chips.

## Interaction Modes

**Tell**: the agent explains concepts and answers questions. **Show**: the agent demonstrates tasks with step-by-step guidance and visual highlighting. **Do**: the agent performs actions in the browser on the user's behalf.

## Programmatic Usage

### `initWidget`

```typescript
import {
  initWidget,
  unmountWidget,
  updateMarketrixConfig,
  startRecording,
  stopRecording,
  getRecordingState,
} from '@marketrix.ai/widget';

// Production
await initWidget({
  mtxId: 'your-marketrix-id',
  mtxKey: 'your-marketrix-key',
  mtxApiHost: 'https://api.marketrix.ai',
});

// Dev
await initWidget({
  mtxApp: 123,
  mtxAgent: 456,
  mtxApiHost: 'https://api.marketrix.ai',
});

// Mount into a specific container
await initWidget(config, document.getElementById('my-container')!);

// Update config at runtime (unmounts and reinitializes)
await updateMarketrixConfig({ mtxApiHost: 'https://new-api.marketrix.ai' });

// Session recording
await startRecording();
stopRecording();
const isRecording = getRecordingState();

// Destroy widget
unmountWidget();
```

### React Component (Preview Mode)

```tsx
import { MarketrixWidget } from '@marketrix.ai/widget';

function App() {
  return (
    <MarketrixWidget
      settings={{ widget_enabled: true, widget_position: 'bottom_right' /* ... */ }}
      mtxApiHost='https://api.marketrix.ai'
    />
  );
}
```

## API Reference

#### `initWidget(config: MarketrixConfig, container?: HTMLElement): Promise<void>`

Validates credentials, fetches settings from the API, and mounts the widget. Concurrent and duplicate calls are deduplicated.

#### `unmountWidget(): void`

Destroys the widget, stops session recording, and cleans up all resources including the SSE stream connection.

#### `mountWidget(config: AddWidgetConfig): Promise<void>`

Auto-detects mode (preview, production, or dev) and initializes the widget.

#### `getCurrentConfig(): MarketrixConfig | null`

Returns the current widget configuration, or `null` if not initialized.

#### `updateMarketrixConfig(newConfig: Partial<MarketrixConfig>): Promise<void>`

Updates the widget configuration at runtime. Unmounts the current widget and reinitializes with the merged config.

#### `startRecording(): Promise<void>`

Starts RRWeb session recording. Throws if the widget was not initialized with `mtxApiHost` and `mtxApp`.

#### `stopRecording(): void`

Stops RRWeb session recording without unmounting the widget.

#### `getRecordingState(): boolean`

Returns whether RRWeb session recording is currently active.

#### `MarketrixWidget` (React Component)

React component for preview mode rendering. Accepts `settings`, `container`, `mtxId`, `mtxKey`, and `mtxApiHost` props.

## Exported Types

```typescript
interface MarketrixConfig {
  mtxId?: string;
  mtxKey?: string;
  mtxApp?: number;
  mtxAgent?: number;
  mtxApiHost?: string;
  userId?: number;
  widget_position_offset?: { x?: number; y?: number };
  widget_position_z_index?: number;
  isPreviewMode?: boolean;
  // All WidgetSettingsData fields (optional)
}
```

## Development

### Prerequisites

- Node.js 24 (CI pins `node-version: 24`)
- npm

### Setup

```bash
git clone <repository-url>
cd widget
npm install
npm start        # dev server on port 9001 (widget.marketrix.localhost)
npm run build    # production build → dist/widget.mjs
```

### Project Structure

```
widget/
├── src/
│   ├── components/       # React components (base, blocks, chat, navigation, ui, views)
│   ├── design-system/    # design tokens + primitives
│   ├── context/          # WidgetContext provider
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Core services (StreamClient, ChatService, SessionRecorder, ToolService, …)
│   ├── sdk/              # oRPC client + scoped contract mirror (contract.ts + contracts/*)
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions (incl. bootstrap.tsx — closed Shadow DOM mount)
│   ├── constants/        # Config constants
│   ├── lib/              # shared helpers
│   └── index.tsx         # Main entry point (public API)
├── public/loader.js      # classic script-tag loader
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Build System

Vite with CSS injection, Shadow DOM isolation, ESM format, TypeScript declarations, and Terser minification.

Output files:

- `dist/widget.mjs` — Library build (React as peer dependency)
- `dist/loader.js` — Classic loader script (loads widget.mjs with configured attributes)

## CI/CD

Single workflow `ci.yml` with three jobs:

| Job       | Trigger              | Action                                                                           |
| --------- | -------------------- | ------------------------------------------------------------------------------- |
| `validate` | Push / PR to `dev`   | type-check, lint, build, format:check, test:run, visual/a11y/bundle checks      |
| `build`    | Tag push (`v*`)      | Build Docker image → `marketrix.azurecr.io/widget:{version}` (v-prefix stripped) |
| `publish`  | Tag push (`v*`)      | `npm publish @marketrix.ai/widget` (skipped if version already on registry)      |

`contract-drift.yml` fails PRs whose `src/sdk/` mirror has drifted from `Marketrix-ai/api` (needs the `CONTRACTS_READ_TOKEN` secret). Dev branch pushes do not build images. Deployment to dev/prod is handled by the centralized `deploy.yml` in `infra`.

### Release

```bash
npm run tag <version>            # bumps package.json, refreshes lockfile, builds, commits, tags vX
git push origin HEAD && git push origin v<version>
```

## Dependencies

### Production (peer + runtime)

- `react` / `react-dom` ^19 — peer dependency
- `@rrweb/record` — session recording
- `@orpc/client` / `@orpc/contract` ^1 — type-safe API client (oRPC)
- `@base-ui/react` — UI primitives
- `zod` ^4 — schema validation
- `tailwind-merge` — class merging

### Development

- Vite 8
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- TypeScript 6
- Vitest + Testing Library + axe (unit, integration, a11y)
- ESLint 10 + Prettier
- Terser for production minification

**Quality gates (run before PR):** `npm run code:check` (type-check + lint + format), `npm run test:run`, `npm run build`, then `npm run visual:check`, `npm run a11y:check`, `npm run bundle:check`.

## License

Apache License 2.0 - see LICENSE file for details.

## Support

For support and questions, please contact the Marketrix team or create an issue
in the repository.

[Back to top](#marketrix-widget)
