# Marketrix In-App Support Widget

A modern, React-based in-app support widget for Marketrix that provides Show,
Tell, and Do modes with AI-powered assistance. Designed for easy integration
into any website using a simple script tag.

## Features

- 🎯 **Three Interaction Modes**: Show, Tell, and Do
- 🎨 **Modern UI**: Built with React 19 and Tailwind CSS v4
- 🌙 **Theme Support**: Dark theme with customizable colors and appearance
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- ⚙️ **API-Driven Configuration**: Dynamic settings from integration service
- 🔌 **Easy Integration**: Simple script tag integration
- 🚀 **TypeScript**: Full TypeScript support with comprehensive type definitions
- 📦 **Standalone**: Single file bundle with no external dependencies
- 🎥 **Session Recording**: Built-in RRWeb session recording with start/stop control
- 🔒 **Shadow DOM Isolation**: CSS isolation prevents conflicts with host app
- 🎛️ **Widget Chips**: Quick action chips for common tasks
- 🔄 **WebSocket Communication**: Real-time AI agent communication
- 🖥️ **Screen Sharing**: Screen access modals and video stream display

## Quick Start

### Script Tag Integration (Recommended)

Add the widget to your HTML page using a script tag:

```html
<script
  src="https://cdn.marketrix.io/widget/index.mjs"
  mtx-ai-host="https://agent.marketrix.ai"
  mtx-api-host="https://api.marketrix.ai"
  mtx-id="your-marketrix-id"
  mtx-key="your-marketrix-key"
></script>
```

### Alternative: Dev Mode (Agent & Connection IDs)

For development/testing with direct agent and connection IDs:

```html
<script
  src="https://cdn.marketrix.io/widget/dev/index.mjs"
  mtx-ai-host="https://agent.marketrix.ai"
  mtx-api-host="https://api.marketrix.ai"
  mtx-app="YOUR_CONNECTION_ID"
  mtx-agent="YOUR_AGENT_ID"
></script>
```

## Configuration Options

### Script Attributes

| Attribute      | Type   | Required | Description                                     |
| -------------- | ------ | -------- | ----------------------------------------------- |
| `mtx-id`       | string | ✅\*     | Your Marketrix ID (production mode)             |
| `mtx-key`      | string | ✅\*     | Your Marketrix API key (production mode)        |
| `mtx-app`      | number | ✅\*     | Connection/App ID (dev mode)                    |
| `mtx-agent`    | number | ✅\*     | Agent ID (dev mode)                             |
| `mtx-api-host` | string | ✅       | API server URL (e.g., https://api.marketrix.ai) |
| `mtx-ai-host`  | string | ✅       | AI/Agent server URL for WebSocket connection    |

\*Either `mtx-id` + `mtx-key` (production) OR `mtx-app` + `mtx-agent` (dev) must
be provided.

### Widget Settings (from API)

Widget appearance and behavior are configured through the API. Settings include:

- **Appearance**: Position, colors, border radius, shadows, dimensions
- **Features**: Enable/disable Tell, Show, Do modes, human handoff
- **Device Visibility**: Desktop, mobile, or both
- **Text**: Header, body, greeting messages
- **Chips**: Quick action buttons with predefined questions

## Interaction Modes

### Tell Mode

The agent explains concepts, provides information, or answers questions with
detailed explanations.

### Show Mode

The agent demonstrates how to perform a task with step-by-step guidance and
visual highlighting of UI elements.

### Do Mode

The agent performs actions on your behalf using browser automation tools,
including clicking, typing, scrolling, and navigating.

## Programmatic Usage

### ES Module Import

```typescript
import {
  initWidget,
  unmountWidget,
  mountWidget,
  MarketrixWidget,
  getCurrentConfig,
  updateMarketrixConfig,
  startRecording,
  stopRecording,
  getRecordingState,
} from '@marketrix.ai/widget';

// Initialize with production credentials
await initWidget({
  mtxId: 'your-marketrix-id',
  mtxKey: 'your-marketrix-key',
  mtxApiHost: 'https://api.marketrix.ai',
  mtxAiHost: 'https://agent.marketrix.ai',
});

// Or initialize with dev credentials
await initWidget({
  mtxApp: 123,
  mtxAgent: 456,
  mtxApiHost: 'https://api.marketrix.ai',
  mtxAiHost: 'https://agent.marketrix.ai',
});

// Initialize into a specific container element
await initWidget(config, document.getElementById('my-container')!);

// Update config at runtime (unmounts and reinitializes)
await updateMarketrixConfig({ mtxAiHost: 'https://new-agent.marketrix.ai' });

// Session recording controls
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
      settings={{
        widget_enabled: true,
        widget_appearance: 'default',
        widget_position: 'bottom_right',
        widget_device: 'desktop_mobile',
        widget_header: 'AI Assistant',
        widget_body: 'How can I help you today?',
        widget_greeting: 'Hello! Ask me anything.',
        widget_feature_tell: true,
        widget_feature_show: true,
        widget_feature_do: true,
        widget_feature_human: false,
        widget_background_color: '#ffffff',
        widget_text_color: '#1f2937',
        widget_border_color: '#e5e7eb',
        widget_accent_color: '#3b82f6',
        widget_secondary_color: '#6b7280',
        widget_border_radius: '16px',
        widget_font_size: '14px',
        widget_width: '400px',
        widget_height: '600px',
        widget_shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        widget_animation_duration: '300ms',
        widget_fade_duration: '200ms',
        widget_bounce_effect: true,
        widget_chips: [],
      }}
      mtxApiHost="https://api.marketrix.ai"
      mtxAiHost="https://agent.marketrix.ai"
    />
  );
}
```

### Mount Widget with Auto-Mode Detection

```typescript
import { mountWidget } from '@marketrix.ai/widget';

// Production mode
await mountWidget({
  mtxId: 'your-id',
  mtxKey: 'your-key',
  mtxApiHost: 'https://api.marketrix.ai',
  mtxAiHost: 'https://agent.marketrix.ai',
});

// Dev mode
await mountWidget({
  mtxApp: 123,
  mtxAgent: 456,
  mtxApiHost: 'https://api.marketrix.ai',
  mtxAiHost: 'https://agent.marketrix.ai',
});

// Preview mode (with settings directly)
await mountWidget({
  settings: widgetSettings,
  mtxApiHost: 'https://api.marketrix.ai',
  mtxAiHost: 'https://agent.marketrix.ai',
});
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd widget
```

2. Install dependencies (git hooks auto-installed via lefthook):

```bash
npm install
```

3. Start development server:

```bash
npm start
```

4. Build for production:

```bash
npm run build
```

### Testing Widget on Any Website

#### Option 1: Bookmarklet (Quick Testing)

Build and serve the widget locally:

```bash
npm run build
npx serve dist -l 5174 --cors
```

Create a bookmark with this URL:

```javascript
javascript: (function () {
  var s = document.createElement('script');
  s.src = 'http://localhost:5174/index.mjs';
  s.setAttribute('mtx-ai-host', 'https://agent.marketrix.ai');
  s.setAttribute('mtx-api-host', 'https://api.marketrix.ai');
  s.setAttribute('mtx-app', 'YOUR_CONNECTION_ID');
  s.setAttribute('mtx-agent', 'YOUR_AGENT_ID');
  document.head.appendChild(s);
})();
```

#### Option 2: Dev Server

```bash
npm start
```

The dev server runs on port 5174 by default (configurable via `PORT` or
`VITE_PORT` env vars). Visit `https://localhost:5174` and accept the
certificate, then use:

```javascript
javascript: (function () {
  var s = document.createElement('script');
  s.src = 'https://localhost:5174/index.mjs';
  s.setAttribute('mtx-ai-host', 'https://agent.marketrix.ai');
  s.setAttribute('mtx-api-host', 'https://api.marketrix.ai');
  s.setAttribute('mtx-app', 'YOUR_CONNECTION_ID');
  s.setAttribute('mtx-agent', 'YOUR_AGENT_ID');
  document.head.appendChild(s);
})();
```

#### Option 3: Chrome Extension

See [chrome-extension/README.md](chrome-extension/README.md) for persistent
widget injection across page navigations.

### Debug Tools

Build the debug panel using the dedicated Vite config:

```bash
npx vite build --config vite.config.debug.ts
npx serve dist -l 5174 --cors
```

Then use this bookmarklet on any website:

```javascript
javascript: (function () {
  var s = document.createElement('script');
  s.src = 'http://localhost:5174/debug.js';
  document.body.appendChild(s);
})();
```

Press `Ctrl+Shift+D` to toggle the debug panel.

### Project Structure

```
widget/
├── src/
│   ├── components/           # React components
│   │   ├── chat/             # Chat UI components
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageContent.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── ProgressLine.tsx
│   │   │   ├── SuggestedActions.tsx
│   │   │   ├── TaskStatusIcon.tsx
│   │   │   ├── ThinkingIndicator.tsx
│   │   │   ├── VideoStreamDisplay.tsx
│   │   │   └── WelcomeMessage.tsx
│   │   ├── debug/            # Debug panel (dev only)
│   │   │   └── DebugPanel.tsx
│   │   ├── dev/              # Dev testing components
│   │   │   └── DomTestPanel.tsx
│   │   ├── input/            # Input components
│   │   │   ├── MessageInput.tsx
│   │   │   └── ModeSelector.tsx
│   │   ├── layout/           # Layout components
│   │   │   └── WidgetButton.tsx
│   │   ├── ui/               # UI utility components
│   │   │   ├── DiagnosticModal.tsx
│   │   │   ├── ErrorDisplay.tsx
│   │   │   ├── ScreenAccessModal.tsx
│   │   │   └── WidgetSettingsLoader.tsx
│   │   ├── BrowserTools.tsx
│   │   └── MarketrixWidget.tsx
│   ├── context/              # React context
│   │   └── WidgetContext.tsx
│   ├── hooks/                # Custom React hooks
│   │   ├── usePageLifecycle.ts
│   │   ├── useResize.ts
│   │   ├── useTaskState.ts
│   │   └── useWidget.ts
│   ├── services/             # Core services
│   │   ├── ApiService.ts
│   │   ├── ChatService.ts
│   │   ├── ConfigManager.ts
│   │   ├── DevTestService.ts
│   │   ├── DomService.ts
│   │   ├── IntegrationService.ts
│   │   ├── ScreenShareService.ts
│   │   ├── SessionManager.ts
│   │   ├── SessionRecorder.ts
│   │   ├── ShowModeService.ts
│   │   ├── StorageService.ts
│   │   ├── ToolService.ts
│   │   ├── ValidationService.ts
│   │   └── WebSocketClient.ts
│   ├── sdk/                  # API SDK (oRPC client + contract)
│   │   ├── index.ts          # Client setup and exports
│   │   ├── routes.ts         # oRPC contract/route definitions
│   │   └── schema.ts         # Zod schemas for API types
│   ├── types/                # TypeScript types
│   │   ├── assets.d.ts
│   │   ├── browserTools.ts
│   │   ├── global.d.ts
│   │   ├── index.ts
│   │   └── toolMessages.ts
│   ├── utils/                # Utility functions
│   │   ├── apiUtils.ts
│   │   ├── bootstrap.tsx
│   │   ├── chat.ts
│   │   ├── cleanupUtils.ts
│   │   ├── common.ts
│   │   ├── devTools.ts
│   │   ├── dom.ts
│   │   ├── format.ts
│   │   ├── persistence.ts
│   │   ├── stateUtils.ts
│   │   ├── validation.ts
│   │   └── widgetPositioning.ts
│   ├── lib/                  # Shared utility library
│   │   └── utils.ts          # Class name helper (cn)
│   ├── constants/            # Configuration constants
│   │   ├── config.ts         # App configuration (URLs, defaults)
│   │   └── theme.ts          # Dark theme classes and color tokens
│   ├── assets/               # Static assets (icons, logos)
│   ├── debug.tsx             # Debug panel entry point
│   ├── index.css             # Global styles
│   └── index.tsx             # Main entry point
├── chrome-extension/         # Chrome extension for persistent injection
├── scripts/                  # Build & release scripts
│   └── release.sh
├── vite.config.ts            # Vite configuration (dev + production)
├── vite.config.debug.ts      # Debug panel build configuration
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
├── tsconfig.build.json       # TypeScript config for declaration generation
└── package.json
```

## API Reference

### Exported Functions

#### `initWidget(config: MarketrixConfig, container?: HTMLElement): Promise<void>`

Initializes the widget with the provided configuration. Validates credentials,
fetches settings from the API, and mounts the widget to the DOM. Optionally
accepts a container element to mount within. Safe to call multiple times —
concurrent and duplicate calls are deduplicated.

#### `unmountWidget(): void`

Destroys the widget and removes it from the DOM. Also stops session recording
and cleans up all resources including the WebSocket connection.

#### `mountWidget(config: AddWidgetConfig): Promise<void>`

Auto-detects mode (preview, production, or dev) and initializes the widget.

#### `getCurrentConfig(): MarketrixConfig | null`

Returns the current widget configuration, or `null` if not initialized.

#### `updateMarketrixConfig(newConfig: Partial<MarketrixConfig>): Promise<void>`

Updates the widget configuration at runtime. Unmounts the current widget and
reinitializes with the merged config.

#### `startRecording(): Promise<void>`

Starts RRWeb session recording. Safe to call while a previous start is
in-flight. Throws if the widget was not initialized with `mtxApiHost` and
`mtxApp`.

#### `stopRecording(): void`

Stops RRWeb session recording without unmounting the widget. Recording can be
resumed later with `startRecording()`.

#### `getRecordingState(): boolean`

Returns whether RRWeb session recording is currently active.

#### `MarketrixWidget` (React Component)

React component for preview mode rendering. Accepts `settings`, `container`,
`mtxId`, `mtxKey`, `mtxApiHost`, and `mtxAiHost` props.

### Default Export

The module also provides a default export object bundling all functions:

```typescript
import widget from '@marketrix.ai/widget';

widget.initWidget(config);
widget.unmountWidget();
widget.mountWidget(config);
widget.getCurrentConfig();
widget.updateMarketrixConfig(newConfig);
widget.startRecording();
widget.stopRecording();
widget.getRecordingState();
// widget.MarketrixWidget — React component
```

### Exported Types

```typescript
// Core configuration
interface MarketrixConfig {
  // Production mode credentials
  mtxId?: string;
  mtxKey?: string;

  // Dev mode credentials
  mtxApp?: number;
  mtxAgent?: number;

  // API configuration
  mtxApiHost?: string;
  mtxAiHost?: string;

  // Optional user ID
  userId?: number;

  // Widget position overrides
  widget_position_offset?: { x?: number; y?: number };
  widget_position_z_index?: number;

  // Preview mode flag
  isPreviewMode?: boolean;

  // All WidgetSettingsData fields (optional)
  // ...
}

// Chat message
interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: InstructionType;
  videoStream?: MediaStream;
  isScreenAccessRequest?: boolean;
  screenShareStatus?: 'allowed' | 'denied';
  isSystemMessage?: boolean;
  isPlaceholder?: boolean;
  placeholderState?: 'thinking' | 'waiting-for-user';
  parts?: MessagePart[];
  taskStatus?: 'ongoing' | 'done' | 'failed' | 'stopped';
}

// Message part (text or progress indicator)
interface MessagePart {
  type: 'text' | 'progress';
  content: string;
  status?: 'running' | 'completed' | 'failed' | 'canceled';
  toolName?: string;
  hideIcon?: boolean;
  textStyle?: 'default' | 'muted';
}

// Widget state
interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  agentAvailable: boolean;
  error?: string;
  activeTaskId: string | null;
  isTaskRunning: boolean;
  taskProgress: TaskProgress[];
}

// Task progress tracking
interface TaskProgress {
  tool_name: string;
  tool_params: Record<string, unknown>;
  step: number;
  explanation: string;
  mode: string;
  timestamp: number;
}

// Instruction types
type InstructionType = 'tell' | 'show' | 'do';
```

## CI/CD & Deployment

GitHub Actions workflows in `.github/workflows/`. All build and deploy jobs
are delegated to `base.yml` as a reusable workflow:

| Workflow         | Trigger         | Action                                                 |
| ---------------- | --------------- | ------------------------------------------------------ |
| `base.yml`       | Called by others | Reusable workflow: build (sanity) or deploy (full)     |
| `dev-build.yml`  | Push to `dev`   | Sanity check via `base.yml` (npm ci + build, no upload)|
| `prod-build.yml` | Release created | Sanity check via `base.yml` (npm ci + build, no upload)|
| `deploy.yml`     | Manual dispatch | Build + upload to Azure Blob Storage + purge CDN cache |

**Deploy options:**

- **Environment**: `dev` or `prod`
- **Version** (required for prod): Git tag to checkout and build from (e.g. `v1.2.0`).

Dev builds are uploaded to `widget/dev/` and prod builds to `widget/latest/` on Azure CDN.

## Build System

The widget uses Vite with:

- CSS injection plugin for single-file bundles
- Shadow DOM isolation for CSS
- ESM format for both library and standalone builds
- TypeScript declaration generation (`tsconfig.build.json`)
- Source maps for debugging
- Terser minification with console/debugger stripping in production
- Hot-reload dev server that rebuilds the production bundle on file changes

Output files:

- `dist/index.mjs` - Library build (React as peer dependency)
- `dist/standalone.mjs` - Standalone build (all dependencies bundled)
- `dist/debug.js` - Debug panel bundle (IIFE format, unminified)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

### Production

- `react` / `react-dom` v19 (peer dependency)
- `@rrweb/record` - Session recording
- `@orpc/client` / `@orpc/contract` v1 - Type-safe API client (oRPC)
- `react-icons` - Icons
- `zod` - Schema validation

### Development

- Vite 6
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- TypeScript 5
- ESLint + Prettier
- Lefthook for git hooks
- Terser for production minification

## License

MIT License - see LICENSE file for details.

## Support

For support and questions, please contact the Marketrix team or create an issue
in the repository.
