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

1. Injects a React 19 importmap pointing at `esm.sh/react@19`. If your page already has an importmap before the loader, the browser keeps your entries — a later import map never overrides an earlier key — so a host that already ships React 19 keeps its own copy.
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

`mountWidget` auto-detects the credential mode (production / preview) from the config you pass.

---

## Credential modes

The widget supports two modes, auto-detected from the credentials you provide.

| Mode           | Credentials                       | Script attributes                     | Network                                                         |
| -------------- | --------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| **Production** | `mtxId` + `mtxKey` + `mtxApiHost` | `mtx-id` + `mtx-key` + `mtx-api-host` | Fetches settings from the API, opens the live stream            |
| **Preview**    | `settings` object passed in code  | —                                     | No network — renders appearance only from the supplied settings |

All modes also accept the common options below.

---

## Configuration options

These apply to every mode (script attribute → config key):

| Config key                | Script attribute      | Type          | Description                                                                                                                                                                                  |
| ------------------------- | --------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `container`               | —                     | `HTMLElement` | Element to mount inside (programmatic only). Defaults to a container appended to `<body>`.                                                                                                   |
| `widget_position_z_index` | —                     | number        | `z-index` floor for the launcher and panel. Raised to the widget's own layer token if you pass a lower value.                                                                                |
| `show_widget`             | —                     | boolean       | When `false`, the widget initializes fully but its UI stays hidden. Default `true`.                                                                                                          |
| `use_screenshare`         | `mtx-use-screenshare` | boolean       | When `false`, screen-share requests are auto-denied and the Share Screen button is hidden. Default `true`. Disable via `mtx-use-screenshare="false"`.                                        |
| `styleNonce`              | `mtx-style-nonce`     | string        | A CSP nonce applied to the widget's injected `<style>` element. Required only if your `style-src` policy has no `'unsafe-inline'` — see [Content Security Policy](#content-security-policy). |

Widget **appearance and behavior** (position, colors, sizing, border radius, animation, enabled Tell/Show/Do features, visibility, greeting toast, optional session recording, header/body/greeting text, and quick-action chips) are configured in the Marketrix dashboard and fetched from the API at init. A hidden widget stays visible in the dashboard preview.

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

The loader takes care of the React 19 importmap. If you manage your own importmap, place it before the loader; your entries win and the loader's map only fills what is missing:

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

All functions are named exports of `@marketrix.ai/widget`.

```ts
import {
  mountWidget,
  initWidget,
  unmountWidget,
  updateMarketrixConfig,
  getCurrentConfig,
  MarketrixWidgetPreview,
} from '@marketrix.ai/widget';
```

### `mountWidget(config): Promise<void>`

Auto-detects the mode (preview / production) from `config` and initializes the widget, throwing if neither `settings` nor `mtxId` + `mtxKey` is present. The recommended entry point for programmatic use.

```ts
// Production
await mountWidget({ mtxId, mtxKey, mtxApiHost });

// Preview (no network — just renders the appearance)
await mountWidget({ settings: { widget_enabled: true, widget_position: 'bottom_right' /* ... */ } });
```

### `initWidget(config, container?): Promise<void>`

Lower-level production initializer. Validates credentials, fetches settings from the API, mounts into a closed Shadow DOM, and opens the event stream. Optionally mounts inside a specific `container`. Concurrent and duplicate calls are deduplicated; only one production widget runs per page.

```ts
await initWidget({ mtxId, mtxKey, mtxApiHost }, document.getElementById('my-container')!);
```

### `unmountWidget(): void`

Destroys the widget, closes the stream connection, and cleans up all resources.

### `updateMarketrixConfig(partial): Promise<void>`

Merges `partial` (a `Partial<MarketrixConfig>`) into the current config and re-mounts: a preview stays a preview, a live widget re-runs `initWidget`. Use to switch API host, credentials, etc. at runtime.

### `getCurrentConfig()`

Returns the active configuration — your options merged with the dashboard settings — or `null` if the widget isn't initialized.

### Settings

Widget settings are managed in the dashboard. `widget_appearance: 'hidden'` keeps the widget initialized but suppresses its visible UI on the host page; previews remain visible. `widget_greeting_toast` controls the welcome toast, and `widget_recording` enables rrweb session recording. Recording is off by default.

#### Session recording privacy

When recording is enabled, **every input value is masked** — recordings capture that a field was typed into, never what was typed. To exclude more of your page, add either class to any element:

| Class                    | Effect                                                      |
| ------------------------ | ----------------------------------------------------------- |
| `mtx-mask` / `rr-mask`   | Text content inside the element is masked                   |
| `mtx-block` / `rr-block` | The element is replaced by a placeholder and never recorded |

Both the `mtx-` and rrweb's native `rr-` prefixes are honoured, so existing `rr-block` / `rr-mask` markup keeps working.

### `MarketrixWidgetPreview` — React component

For previewing appearance inside a React app (e.g. a settings/configuration screen). Renders into its own Shadow DOM and makes no network calls.

```tsx
import { MarketrixWidgetPreview } from '@marketrix.ai/widget';

function Preview() {
  return (
    <MarketrixWidgetPreview
      settings={{ widget_enabled: true, widget_position: 'bottom_right' /* ...WidgetSettingsData */ }}
    />
  );
}
```

Props: `settings` (required) and `container?`.

---

## Interaction modes

- **Tell** — the agent explains concepts and answers questions in chat.
- **Show** — the agent walks the user through a task step-by-step, highlighting the relevant elements on the page.
- **Do** — the agent performs the actions in the browser on the user's behalf.

---

## Exported types

TypeScript types are bundled with the package:

- `MarketrixConfig` — what `initWidget` takes: the required `mtxId` + `mtxKey` + `mtxApiHost` (the API server URL, e.g. `https://api.marketrix.ai`; there is no baked-in default) plus `ClientOwnedConfig`. Appearance comes only from the dashboard settings; `updateMarketrixConfig` takes a `Partial<MarketrixConfig>`.
- `AddWidgetConfig` — discriminated config for `mountWidget` (production / preview variants + common options).
- `ClientOwnedConfig` — the host-supplied options the API never sends (`widget_position_z_index`, `show_widget`, `use_screenshare`, `styleNonce`).
- `MarketrixWidgetPreviewProps` — props for the `MarketrixWidgetPreview` component.
- `WidgetSettingsData` — the dashboard settings shape `MarketrixWidgetPreview` and preview-mode `mountWidget` take.
- `InstructionType` (`'tell' | 'show' | 'do'`).

---

## Upgrading to 5.0.1

- **TypeScript now requires `mtxApiHost`** in `MarketrixConfig` and in the credentials form of `AddWidgetConfig`. The runtime already refused to start without it, so only type-checking changes; it is no longer part of `ClientOwnedConfig`.
- **Saved widget positions and panel sizes reset once.** They are stored in a new format, so a visitor's dragged position and resized panel return to your dashboard defaults the first time 5.0.1 loads.

---

## Upgrading to 5.0

5.0 narrows the public API. Each removal and what to use instead:

- **Dashboard settings are no longer accepted in `MarketrixConfig`.** The `widget_*` appearance and behaviour keys (`widget_accent_color`, `widget_background_color`, `widget_text_color`, `widget_position`, `widget_greeting`, `widget_chips` and the rest) were always overwritten by the dashboard settings. Set them in the dashboard; to render them before saving, pass them to `MarketrixWidgetPreview` or preview-mode `mountWidget` as `WidgetSettingsData`. `widget_position_z_index` stays, as a `ClientOwnedConfig` option.
- **`mtxApp` and `isPreviewMode` are no longer config keys**, and `mtxId`/`mtxKey` are now required. The application resolves from your credentials; for a preview, use `MarketrixWidgetPreview` or preview-mode `mountWidget`.
- **`userId` is no longer a config key.** The widget never sends a user id; drop it from your config. A 4.x widget still configured with `userId` no longer connects, because the api refuses the `user_id` it sends; 4.x widgets without `userId` are unaffected.
- **The default export is gone.** Import the named exports instead: `import { initWidget } from '@marketrix.ai/widget'`.
- **The `WidgetState` and `ChatMessage` types are no longer exported.** Nothing in the public API produced or accepted them, so delete those imports.
- **With no suggested actions configured, a live widget shows none.** Previously a live widget showed built-in example chips. Those examples now appear only in preview.

---

## Requirements

- **React 19** (`react`/`react-dom` `^19.2.3`) on the host page — peer dependency, not bundled. The script-tag loader provides it via importmap; npm consumers supply it from their app.
- A reachable Marketrix API host (`mtxApiHost` / `mtx-api-host`).
- Valid credentials (`mtxId` + `mtxKey`) for production mode.

---

## Content Security Policy

The widget mounts into a closed Shadow DOM and injects its own stylesheet as an inline `<style>`
element inside it (there is no external stylesheet to point a `<link>` at). A host page enforcing a
`style-src` policy with no `'unsafe-inline'` blocks that element, leaving the widget mounted but
entirely unstyled. If your policy is that strict, either:

- add `'unsafe-inline'` to `style-src` (simplest, and scoped to styles only), or
- generate a per-request nonce, add it to your `style-src` policy (`style-src 'nonce-<value>'`), and
  pass the same value as `styleNonce` (programmatic) or `mtx-style-nonce` (script tag) — the widget
  applies it to its injected `<style>` element.

The widget makes network requests only to the configured `mtxApiHost`, with credentials explicitly
omitted on every request (it authenticates via `mtxId`/`mtxKey`, never a cookie) — no `connect-src`
entry beyond your own API host is required, and no third-party origin is ever contacted.

---

## License

Apache License 2.0 — see the `LICENSE` file.

## Support

Contact the Marketrix team or open an issue in the repository.
