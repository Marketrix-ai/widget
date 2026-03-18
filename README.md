# Marketrix Widget

Embeddable support widget for Marketrix. Integrates into any website via script tag.

## Quick Start

```html
<script
  src="https://storage.marketrix.ai/widget/index.mjs"
  mtx-api-host="https://api.marketrix.ai"
  mtx-id="your-marketrix-id"
  mtx-key="your-marketrix-key"
></script>
```

## Configuration Options

### Script Attributes

| Attribute      | Type   | Required | Description                                     |
| -------------- | ------ | -------- | ----------------------------------------------- |
| `mtx-id`       | string | \*       | Your Marketrix ID (production mode)             |
| `mtx-key`      | string | \*       | Your Marketrix API key (production mode)        |
| `mtx-app`      | number | \*       | Application ID (dev mode)                       |
| `mtx-agent`    | number | \*       | Agent ID (dev mode)                             |
| `mtx-api-host` | string | yes      | API server URL (e.g., `https://api.marketrix.ai`) |

\*Either `mtx-id` + `mtx-key` (production) OR `mtx-app` + `mtx-agent` (dev) must be provided.

### Widget Settings

Widget appearance and behavior are configured through the API. Settings include position, colors, border radius, dimensions, enabled features, device visibility, header/body/greeting text, and quick-action chips.

## Interaction Modes

**Tell**: the agent explains concepts and answers questions. **Show**: the agent demonstrates tasks with step-by-step guidance and visual highlighting. **Do**: the agent performs actions in the browser on the user's behalf.

## Programmatic Usage

### `initWidget`

```typescript
import { initWidget, unmountWidget, updateMarketrixConfig, startRecording, stopRecording, getRecordingState } from '@marketrix.ai/widget';

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
      settings={{ widget_enabled: true, widget_position: 'bottom_right', /* ... */ }}
      mtxApiHost="https://api.marketrix.ai"
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

- Node.js 18+
- npm

### Setup

```bash
git clone <repository-url>
cd widget
npm install
npm start        # dev server on port 5174
npm run build    # production build
```

### Project Structure

```
widget/
├── src/
│   ├── components/       # React components (chat, layout, UI, input)
│   ├── context/          # WidgetContext provider
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Core services (stream, chat, recording, etc.)
│   ├── sdk/              # oRPC client + contract mirrors
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions
│   ├── constants/        # Config constants and theme tokens
│   └── index.tsx         # Main entry point
├── chrome-extension/     # Chrome extension for persistent injection
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Build System

Vite with CSS injection, Shadow DOM isolation, ESM format, TypeScript declarations, and Terser minification.

Output files:

- `dist/index.mjs` — Library build (React as peer dependency)
- `dist/standalone.mjs` — Standalone build (all dependencies bundled)

## CI/CD

| Workflow       | Trigger            | Action                                          |
| -------------- | ------------------ | ----------------------------------------------- |
| `validate.yml` | Push to `dev` / PR | Type check, lint, build                         |
| `build.yml`    | Tag push (`v*`)    | Build Docker image, push to ACR, publish to npm |

Tag pushes publish `@marketrix.ai/widget` to npm. Deployment is handled by the centralized `deploy.yml` workflow in `infra`.
