# Marketrix Widget

The embeddable Marketrix support widget. Drop it into any web page and your users get an in-product assistant that can **Tell** them how something works, **Show** them step-by-step with on-page highlighting, or **Do** the task for them in the browser.

Published to npm as [`@marketrix.ai/widget`](https://www.npmjs.com/package/@marketrix.ai/widget). Ships as a single ES module (`widget.mjs`) plus a classic `loader.js` bootstrap.

> **React 19 is required.** The widget treats `react` and `react-dom` as **peer dependencies** and does not bundle them — the host page must provide React 19. The script-tag loader injects a React 19 importmap for you; npm consumers already have React in their app.

---

## Install

There are two integration paths. Most sites should use the **script tag** — it's the simplest and provides React for you.

### 1. Script tag (recommended)

Add one `<script>` to your page `<head>`, **before any `<script type="module">` tags** (the loader installs the React importmap that your module scripts rely on):

```html
<script
  src="https://widget.marketrix.ai/loader.js"
  mtx-id="your-marketrix-id"
  mtx-key="your-marketrix-key"
  mtx-api-host="https://api.marketrix.ai"
></script>
```

`loader.js`:

1. Injects a React 19 importmap (defaults to `esm.sh/react@19`). If your page already has an importmap, the loader **merges** it and your mappings win — so a host that already ships React 19 keeps its own copy.
2. Injects `<script type="module" src=".../widget.mjs">` from the same origin as the loader.
3. Forwards every `mtx-*` attribute from the loader tag to the widget.

The widget then **auto-initializes** from those attributes — no extra JavaScript required.

### 2. npm / programmatic

```bash
npm install @marketrix.ai/widget
# react@^19.2.3 and react-dom@^19.2.3 must already be installed in your app
```

```ts
import { mountWidget } from '@marketrix.ai/widget';

await mountWidget({
  mtxId: 'your-marketrix-id',
  mtxKey: 'your-marketrix-key',
  mtxApiHost: 'https://api.marketrix.ai',
});
```

`mountWidget` auto-detects the credential mode (production / dev / preview) from the config you pass.

---

## Credential modes

The widget supports three modes, auto-detected from the credentials you provide.

| Mode           | Credentials                      | Script attributes    | Network                                                         |
| -------------- | -------------------------------- | -------------------- | --------------------------------------------------------------- |
| **Production** | `mtxId` + `mtxKey`               | `mtx-id` + `mtx-key` | Fetches settings from the API, opens the live stream            |
| **Dev**        | `mtxApp` (application id)        | `mtx-app`            | Same as production, keyed by id instead of credentials          |
| **Preview**    | `settings` object passed in code | —                    | No network — renders appearance only from the supplied settings |

All modes also accept the common options below.

---

## Configuration options

These apply to every mode (script attribute → config key):

| Config key        | Script attribute      | Type          | Description                                                                                                                                           |
| ----------------- | --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mtxApiHost`      | `mtx-api-host`        | string        | API server URL, e.g. `https://api.marketrix.ai`. The widget has no baked-in API host — you must supply it.                                            |
| `container`       | —                     | `HTMLElement` | Element to mount inside (programmatic only). Defaults to a container appended to `<body>`.                                                            |
| `userId`          | —                     | number        | Associates widget activity with one of your users.                                                                                                    |
| `show_widget`     | —                     | boolean       | When `false`, the widget initializes fully but its UI stays hidden. Default `true`.                                                                   |
| `use_screenshare` | `mtx-use-screenshare` | boolean       | When `false`, screen-share requests are auto-denied and the Share Screen button is hidden. Default `true`. Disable via `mtx-use-screenshare="false"`. |

Widget **appearance and behavior** (position, colors, sizing, border radius, animation, enabled Tell/Show/Do/Human features, device visibility, header/body/greeting text, and quick-action chips) are configured in the Marketrix dashboard and fetched from the API at init. You don't set them in the embed — except in preview mode, where you pass them inline as `settings`.

### Full script-tag example

```html
<!doctype html>
<html>
  <head>
    <script
      src="https://widget.marketrix.ai/loader.js"
      mtx-id="your-marketrix-id"
      mtx-key="your-marketrix-key"
      mtx-api-host="https://api.marketrix.ai"
      mtx-use-screenshare="false"
    ></script>
  </head>
  <body>
    <!-- your app -->
  </body>
</html>
```

The loader takes care of the React 19 importmap. If you manage your own importmap, place it before the loader and the loader will merge (and defer to) it:

```html
<script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19",
      "react-dom": "https://esm.sh/react-dom@19",
      "react-dom/client": "https://esm.sh/react-dom@19/client",
      "react/jsx-runtime": "https://esm.sh/react@19/jsx-runtime"
    }
  }
</script>
<script src="https://widget.marketrix.ai/loader.js" mtx-id="..." mtx-key="..." mtx-api-host="..."></script>
```

---

## Programmatic API

All functions are named exports of `@marketrix.ai/widget` (also available on the default export).

```ts
import {
  mountWidget,
  initWidget,
  unmountWidget,
  updateMarketrixConfig,
  getCurrentConfig,
  startRecording,
  stopRecording,
  getRecordingState,
  MarketrixWidget,
} from '@marketrix.ai/widget';
```

### `mountWidget(config): Promise<void>`

Auto-detects the mode (preview / production / dev) from `config` and initializes the widget. The recommended entry point for programmatic use.

```ts
// Production
await mountWidget({ mtxId, mtxKey, mtxApiHost });

// Dev
await mountWidget({ mtxApp: 123, mtxApiHost });

// Preview (no network — just renders the appearance)
await mountWidget({ settings: { widget_enabled: true, widget_position: 'bottom_right' /* ... */ } });
```

### `initWidget(config, container?): Promise<void>`

Lower-level production/dev initializer. Validates credentials, fetches settings from the API, mounts into a closed Shadow DOM, opens the event stream, and starts session recording once a chat id exists. Optionally mounts inside a specific `container`. Concurrent and duplicate calls are deduplicated; only one production widget runs per page.

```ts
await initWidget({ mtxId, mtxKey, mtxApiHost }, document.getElementById('my-container')!);
```

### `unmountWidget(): void`

Destroys the widget, stops session recording, closes the stream connection, and cleans up all resources.

### `updateMarketrixConfig(partial): Promise<void>`

Merges `partial` into the current config and re-initializes (unmount + `initWidget`). Use to switch API host, credentials, etc. at runtime.

### `getCurrentConfig(): MarketrixConfig | null`

Returns the active configuration, or `null` if the widget isn't initialized.

### Session recording

The widget records user sessions (via rrweb) automatically once initialized. These helpers let you control it:

- `startRecording(): Promise<void>` — start or resume recording. Throws if the widget wasn't initialized with `mtxApiHost` and an application (`mtxApp`).
- `stopRecording(): void` — pause recording without unmounting the widget.
- `getRecordingState(): boolean` — whether recording is currently active.

### `MarketrixWidget` — React component (preview)

For previewing appearance inside a React app (e.g. a settings/configuration screen). Renders into its own Shadow DOM and makes no network calls.

```tsx
import { MarketrixWidget } from '@marketrix.ai/widget';

function Preview() {
  return (
    <MarketrixWidget
      settings={{ widget_enabled: true, widget_position: 'bottom_right' /* ...WidgetSettingsData */ }}
      mtxApiHost='https://api.marketrix.ai'
    />
  );
}
```

Props: `settings` (required), `container?`, `mtxId?`, `mtxKey?`, `mtxApiHost?`.

---

## Interaction modes

- **Tell** — the agent explains concepts and answers questions in chat.
- **Show** — the agent walks the user through a task step-by-step, highlighting the relevant elements on the page.
- **Do** — the agent performs the actions in the browser on the user's behalf.

---

## Exported types

TypeScript types are bundled with the package:

- `MarketrixConfig` — full config for `initWidget` / `updateMarketrixConfig` (`mtxId`, `mtxKey`, `mtxApp`, `mtxApiHost`, `userId`, `show_widget`, `use_screenshare`, plus all widget appearance settings, optional).
- `AddWidgetConfig` — discriminated config for `mountWidget` (production / dev / preview variants + common options).
- `MarketrixWidgetProps` — props for the `MarketrixWidget` component.
- `ChatMessage`, `WidgetState`, `InstructionType` (`'tell' | 'show' | 'do'`).

---

## Requirements

- **React 19** (`react`/`react-dom` `^19.2.3`) on the host page — peer dependency, not bundled. The script-tag loader provides it via importmap; npm consumers supply it from their app.
- A reachable Marketrix API host (`mtxApiHost` / `mtx-api-host`).
- Valid credentials for production (`mtxId` + `mtxKey`) or dev (`mtxApp`) mode.

---

## License

Apache License 2.0 — see the `LICENSE` file.

## Support

Contact the Marketrix team or open an issue in the repository.
