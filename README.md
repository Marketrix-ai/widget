# Marketrix In-App Support Widget

A modern, React-based in-app support widget for Marketrix that provides Show,
Tell, and Do modes with advanced features like screen sharing, tour
functionality, and API-driven configuration. Designed for easy integration into
any website using a simple script tag.

## Features

- 🎯 **Three Interaction Modes**: Show, Tell, and Do
- 🎨 **Modern UI**: Built with React 18 and Tailwind CSS
- 🌙 **Theme Support**: Light and dark themes with custom theming
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- ⚙️ **API-Driven Configuration**: Dynamic settings from integration service
- 🔌 **Easy Integration**: Simple script tag integration
- 🚀 **TypeScript**: Full TypeScript support with comprehensive type definitions
- 📦 **Standalone**: Single file bundle with no external dependencies
- 🎥 **Screen Sharing**: Built-in screen sharing and recording capabilities
- 🗺️ **Tour System**: Interactive tour functionality with step-by-step guidance
- 🎛️ **Atmosphere Config**: Advanced widget atmosphere and behavior control
- 🏷️ **Widget Chips**: Quick action chips for common tasks
- 🔄 **Auto-Refresh**: Dynamic configuration updates
- 🎭 **Demo Mode**: Built-in demo mode for testing

## Quick Start

### Script Tag Integration (Recommended)

Add the widget to your HTML page using a script tag:

```html
<script
  src="path/to/meet.js"
  marketrix-id="your-marketrix-id"
  marketrix-key="your-marketrix-key"
></script>
```

### Configuration Options

You can customize the widget using data attributes:

```html
<script
  src="path/to/meet.js"
  marketrix-id="your-marketrix-id"
  marketrix-key="your-marketrix-key"
  data-position="bottom_right"
  data-theme="light"
  data-agent-name="Support Agent"
  data-api-base-url="https://api.marketrix.com"
></script>
```

## Configuration Options

### Basic Configuration

| Option         | Type   | Required | Default                  | Description                                                                      |
| -------------- | ------ | -------- | ------------------------ | -------------------------------------------------------------------------------- |
| `marketrixId`  | string | ✅       | -                        | Your Marketrix account ID                                                        |
| `marketrixKey` | string | ✅       | -                        | Your Marketrix API key                                                           |
| `apiBaseUrl`   | string | ❌       | `http://localhost:8080`  | API base URL override                                                            |
| `position`     | string | ❌       | `'bottom_right'`         | Widget position (`'bottom_right'`, `'bottom_left'`, `'top-right'`, `'top-left'`) |
| `theme`        | string | ❌       | `'light'`                | Theme (`'light'` or `'dark'`)                                                    |
| `avatarUrl`    | string | ❌       | -                        | URL to the agent's avatar image                                                  |
| `agentName`    | string | ❌       | `'Support Agent'`        | Display name for the support agent                                               |
| `enabledModes` | array  | ❌       | `['show', 'tell', 'do']` | Array of enabled modes                                                           |

### Advanced Configuration

The widget supports extensive configuration through the atmosphere system and
integration service:

#### Widget Customization

- **Colors**: Primary, secondary, background, text, border colors
- **Sizes**: Width, height, border radius, font size
- **Animations**: Slide duration, fade duration, bounce effects
- **Shadows**: Custom shadow configurations
- **Z-index**: Layering control

#### Device Visibility

- **Desktop**: Show/hide on desktop
- **Tablet**: Show/hide on tablet
- **Mobile**: Show/hide on mobile

#### Advanced Settings

- **Auto-open delay**: Delay before auto-opening
- **Session timeout**: Session timeout duration
- **Max messages**: Maximum message history
- **Typing indicator**: Show typing indicators
- **Read receipts**: Enable read receipts
- **Sound notifications**: Audio notifications
- **Vibration**: Haptic feedback

#### Widget Chips

Quick action chips for common tasks:

```typescript
interface WidgetChipConfig {
  chip_mode: 'show' | 'tell' | 'do';
  chip_text: string;
  type?: string;
  question?: string;
}
```

## Interaction Modes

### Show Mode

The agent will demonstrate how to perform a task or show you the steps to
accomplish something. Includes interactive tour functionality with step-by-step
guidance.

### Tell Mode

The agent will explain concepts, provide information, or answer questions with
detailed explanations.

### Do Mode

The agent will perform actions on your behalf or execute tasks for you,
including screen sharing capabilities for remote assistance.

## API Integration

The widget communicates with the Marketrix API using the following endpoints:

### Core Endpoints

- `GET /integration` - Fetch integration settings and widget configuration
- `GET /tour` - Fetch tour data for specific connections
- `GET /agent/status` - Check agent availability
- `GET /agent/info` - Get agent information

### Integration Service

The widget includes a comprehensive integration service that:

- Fetches widget configuration from the API
- Converts integration settings to atmosphere configuration
- Manages tour data for connections
- Auto-configures widget based on API settings
- Supports dynamic configuration updates

### Authentication

The widget supports multiple authentication methods:

- URL parameters: `marketrix_id` and `marketrix_key`
- Headers: `X-Marketrix-ID` and `X-Marketrix-Key`
- Authorization: `Bearer` token

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd widget
```

2. Install dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

5. Build and run debug tool:

```bash
npm run build:debug
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

See [docs/DEBUG_PANEL_USAGE.md](docs/DEBUG_PANEL_USAGE.md) for detailed debug
panel documentation.

### Project Structure

```
widget/
├── src/
│   ├── components/          # React components
│   │   ├── ChatWindow.tsx   # Main chat interface
│   │   ├── WidgetButton.tsx # Widget toggle button
│   │   ├── MessageList.tsx  # Message display
│   │   ├── MessageInput.tsx # Message input
│   │   ├── ModeSelector.tsx # Mode selection
│   │   ├── ScreenAccessModal.tsx # Screen sharing modal
│   │   ├── ScreenSharePreview.tsx # Screen share preview
│   │   └── DemoWidgetWrapper.tsx # Demo wrapper
│   ├── hooks/              # Custom React hooks
│   │   ├── useMarketrixWidget.ts # Main widget logic
│   │   ├── useWidgetAtmosphere.ts # Atmosphere configuration
│   │   └── useIntegrationSettings.ts # Integration settings
│   ├── services/           # API services
│   │   ├── api.ts          # Main API service
│   │   ├── demo-api.ts     # Demo API service
│   │   ├── integration-settings.ts # Integration settings service
│   │   ├── integrationService.ts # Integration service
│   │   └── tourService.ts   # Tour service
│   ├── sdk/                # SDK components
│   │   ├── integrationService.ts # Integration service
│   │   ├── routes.ts       # API routes
│   │   └── schema.ts       # Schema definitions
│   ├── types/              # TypeScript type definitions
│   │   ├── index.ts        # Main types
│   │   └── assets.d.ts     # Asset types
│   ├── utils/              # Utility functions
│   │   ├── ConfigManager.ts # Configuration management
│   │   ├── formatting.ts   # Text formatting
│   │   ├── highlighting.ts # Syntax highlighting
│   │   └── positioning.ts  # Widget positioning
│   ├── config/             # Configuration files
│   │   └── widget-atmosphere.ts # Atmosphere configuration
│   ├── assets/             # Static assets
│   │   ├── marketrix-icon.png
│   │   ├── marketrix-logo.png
│   │   ├── marktrix-footer.png
│   │   └── send.png
│   ├── index.css           # Global styles
│   └── index.tsx           # Main entry point
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── dist/                   # Build output
    ├── meet.js             # Main widget bundle (IIFE)
    └── index.html          # Demo page
```

## Build System

The widget uses Vite with a custom CSS injection plugin that:

- Bundles all dependencies (React, etc.) into a single file
- Injects CSS directly into the JavaScript bundle
- Outputs an IIFE (Immediately Invoked Function Expression) format
- Creates a standalone `meet.js` file with no external dependencies

## API Reference

### Functions

#### `initMarketrixWidget(config: MarketrixConfig)`

Initializes the widget with the provided configuration.

#### `destroyMarketrixWidget()`

Destroys the widget and removes it from the DOM.

#### `updateMarketrixConfig(newConfig: Partial<MarketrixConfig>)`

Updates the widget configuration dynamically.

#### `getCurrentConfig(): MarketrixConfig`

Returns the current widget configuration.

### Types

#### `MarketrixConfig`

```typescript
interface MarketrixConfig {
  marketrixId: string;
  marketrixKey: string;
  apiBaseUrl?: string;
  position?: 'bottom_right' | 'bottom_left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark';
  avatarUrl?: string;
  agentName?: string;
  enabledModes?: ('show' | 'tell' | 'do')[];

  // Extended atmosphere controls
  session_time?: number;
  sessionActive?: boolean;
  recorded_time?: number;
  recordActive?: boolean;
  widget_text?: WidgetTextConfig;
  widget_type?: 'ai' | 'live' | 'hybrid';
  widget_visible?: boolean;
  widget_customize?: WidgetCustomizeConfig;
  active_avatar?: AvatarConfig;
  avatar_trigger_time?: number;
  enable_widget_popup?: boolean;
  avatar_status?: 'online' | 'offline' | 'busy' | 'away';
  widget_mode?: 'ai' | 'live' | 'hybrid';
  mLive_form?: LiveFormConfig;
  hybrid_agents_on?: boolean;
  hybrid_agents_off?: boolean;
  widget_visible_device?: DeviceVisibilityConfig;
  streaming_avatar_status?: 'idle' | 'typing' | 'speaking' | 'listening';
  widget_position?: WidgetPositionConfig;
  enable_ai_tour?: boolean;
  widget_header_ai?: string;
  widget_body_ai?: string;
  widget_header_live?: string;
  widget_body_live?: string;
  widget_chat_greeting?: string;
  widget_tour_greeting?: string;
  inapp_login_url?: string;
  inapp_login_id?: string;
  inapp_login_password?: string;
  advanced_settings?: AdvancedSettingsConfig;
  themes?: ThemeConfig;
  responsive_breakpoints?: ResponsiveBreakpointsConfig;
}
```

#### `WidgetAtmosphereConfig`

```typescript
interface WidgetAtmosphereConfig {
  session_time: number;
  sessionActive: boolean;
  recorded_time: number;
  recordActive: boolean;
  widget_text: WidgetTextConfig;
  widget_settings: WidgetSettingsConfig;
  widget_type: 'ai' | 'live' | 'hybrid';
  widget_visible: boolean;
  widget_customize: WidgetCustomizeConfig;
  active_avatar: AvatarConfig;
  avatar_trigger_time: number;
  enable_widget_popup: boolean;
  avatar_status: 'online' | 'offline' | 'busy' | 'away';
  widget_mode: 'ai' | 'live' | 'hybrid';
  mLive_form: LiveFormConfig;
  hybrid_agents_on: boolean;
  hybrid_agents_off: boolean;
  widget_visible_device: DeviceVisibilityConfig;
  streaming_avatar_status: 'idle' | 'typing' | 'speaking' | 'listening';
  widget_position: WidgetPositionConfig;
  enable_ai_tour: boolean;
  widget_header_ai: string;
  widget_body_ai: string;
  widget_header_live: string;
  widget_body_live: string;
  widget_chat_greeting: string;
  widget_tour_greeting: string;
  inapp_login_url: string;
  inapp_login_id: string;
  inapp_login_password: string;
  advanced_settings: AdvancedSettingsConfig;
  themes: ThemeConfig;
  responsive_breakpoints: ResponsiveBreakpointsConfig;
}
```

#### `IntegrationSettings`

```typescript
interface IntegrationSettings {
  widget_enabled?: boolean;
  widget_appearance?: string;
  widget_position?: string;
  widget_device?: string;
  widget_header?: string;
  widget_body?: string;
  widget_greeting?: string;
  widget_feature_tell?: boolean;
  widget_feature_show?: boolean;
  widget_feature_do?: boolean;
  widget_feature_request_human?: boolean;
  widget_background_color?: string;
  widget_text_color?: string;
  widget_border_color?: string;
  widget_accent_color?: string;
  widget_secondary_color?: string;
  widget_border_radius?: string;
  widget_font_size?: string;
  widget_width?: string;
  widget_height?: string;
  widget_shadow?: string;
  widget_animation_duration?: string;
  widget_fade_duration?: string;
  widget_bounce_effect?: boolean;
  widget_chips?: Array<{
    chip_mode?: string;
    chip_text?: string;
    type?: string;
    question?: string;
  }>;
}
```

#### `ChatMessage`

```typescript
interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: 'show' | 'tell' | 'do';
}
```

## Advanced Features

### Screen Sharing

The widget includes built-in screen sharing capabilities:

- Screen access modal for permissions
- Screen share preview component
- Recording functionality
- Integration with tour system

### Tour System

Interactive tour functionality with:

- Step-by-step guidance
- Element targeting with selectors
- Action execution
- Tour data management
- Connection-based tours

### Demo Mode

Built-in demo mode for testing:

- Use `demo-marketrix-id` and `demo-marketrix-key`
- Simulated API responses
- Context-aware demo messages
- No real API calls required

### Atmosphere Configuration

Advanced widget atmosphere control:

- Dynamic configuration updates
- Auto-refresh capability
- Session and recording management
- Avatar status control
- Widget visibility management

## Styling

The widget uses Tailwind CSS with custom animations and theming:

- Custom color palette with Marketrix branding
- Smooth animations (fade, slide, genie effects)
- Responsive design with breakpoints
- CSS custom properties for dynamic theming
- Custom keyframes for advanced animations

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions, please contact the Marketrix team or create an issue
in the repository.
