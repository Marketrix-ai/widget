# Marketrix In-App Support Widget

A modern, React-based in-app support widget for Marketrix that provides Show, Tell, and Do modes without video calling or guided tours support.

## Features

- 🎯 **Three Interaction Modes**: Show, Tell, and Do
- 🎨 **Modern UI**: Built with React 18 and Tailwind CSS
- 🌙 **Theme Support**: Light and dark themes
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚙️ **Highly Configurable**: Customizable position, avatar, agent name, and modes
- 🔌 **Easy Integration**: Simple script tag or programmatic initialization
- 🚀 **TypeScript**: Full TypeScript support with type definitions

## Installation

### Using npm/yarn

```bash
npm install @marketrix/inapp-react
# or
yarn add @marketrix/inapp-react
```

### Using CDN

```html
<script src="https://unpkg.com/@marketrix/inapp-react/dist/marketrix-inapp.umd.js"></script>
```

## Quick Start

### Method 1: Script Tag (Recommended)

Add the widget to your HTML page using a script tag with data attributes:

```html
<script 
  src="path/to/marketrix-inapp.umd.js"
  data-marketrix-id="your-marketrix-id"
  data-marketrix-key="your-marketrix-key"
  data-position="bottom-right"
  data-theme="light"
  data-avatar-url="https://example.com/avatar.jpg"
  data-agent-name="Support Agent"
  data-enabled-modes="show,tell,do">
</script>
```

### Method 2: Programmatic Initialization

```javascript
import { initMarketrixWidget } from '@marketrix/inapp-react';

initMarketrixWidget({
  marketrixId: 'your-marketrix-id',
  marketrixKey: 'your-marketrix-key',
  position: 'bottom-right',
  theme: 'light',
  avatarUrl: 'https://example.com/avatar.jpg',
  agentName: 'Support Agent',
  enabledModes: ['show', 'tell', 'do']
});
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `marketrixId` | string | ✅ | - | Your Marketrix account ID |
| `marketrixKey` | string | ✅ | - | Your Marketrix API key |
| `position` | string | ❌ | `'bottom-right'` | Widget position (`'bottom-right'`, `'bottom-left'`, `'top-right'`, `'top-left'`) |
| `theme` | string | ❌ | `'light'` | Theme (`'light'` or `'dark'`) |
| `avatarUrl` | string | ❌ | - | URL to the agent's avatar image |
| `agentName` | string | ❌ | `'Support Agent'` | Display name for the support agent |
| `enabledModes` | array | ❌ | `['show', 'tell', 'do']` | Array of enabled modes |

## Interaction Modes

### Show Mode
The agent will demonstrate how to perform a task or show you the steps to accomplish something.

### Tell Mode
The agent will explain concepts, provide information, or answer questions.

### Do Mode
The agent will perform actions on your behalf or execute tasks for you.

## API Integration

The widget communicates with the Marketrix API using the following endpoints:

- `POST /chat/send` - Send messages
- `GET /agent/status` - Check agent availability
- `GET /agent/info` - Get agent information

Make sure your API endpoints are properly configured to handle these requests.

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd inapp-react
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

### Project Structure

```
src/
├── components/          # React components
│   ├── MarketrixWidget.tsx
│   ├── WidgetButton.tsx
│   ├── ChatWindow.tsx
│   ├── ModeSelector.tsx
│   ├── MessageList.tsx
│   └── MessageInput.tsx
├── hooks/              # Custom React hooks
│   └── useMarketrixWidget.ts
├── services/           # API services
│   └── api.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions
│   ├── positioning.ts
│   └── formatting.ts
├── index.css           # Global styles
└── index.ts            # Main entry point
```

## API Reference

### Functions

#### `initMarketrixWidget(config: MarketrixConfig)`
Initializes the widget with the provided configuration.

#### `destroyMarketrixWidget()`
Destroys the widget and removes it from the DOM.

#### `updateMarketrixConfig(newConfig: Partial<MarketrixConfig>)`
Updates the widget configuration.

#### `getCurrentConfig(): MarketrixConfig`
Returns the current widget configuration.

### Types

#### `MarketrixConfig`
```typescript
interface MarketrixConfig {
  marketrixId: string;
  marketrixKey: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark';
  avatarUrl?: string;
  agentName?: string;
  enabledModes?: ('show' | 'tell' | 'do')[];
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

## Styling

The widget uses Tailwind CSS for styling. You can customize the appearance by:

1. Modifying the Tailwind configuration in `tailwind.config.js`
2. Adding custom CSS classes in `src/index.css`
3. Using CSS custom properties for dynamic theming

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

For support and questions, please contact the Marketrix team or create an issue in the repository.
