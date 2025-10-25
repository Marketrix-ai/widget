# Marketrix In-App Support Widget

A modern, React-based in-app support widget for Marketrix that provides Show, Tell, and Do modes. Designed for easy integration into any website using a simple script tag.

## Features

- 🎯 **Three Interaction Modes**: Show, Tell, and Do
- 🎨 **Modern UI**: Built with React 18 and Tailwind CSS
- 🌙 **Theme Support**: Light and dark themes
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚙️ **Highly Configurable**: Customizable position, avatar, agent name, and modes
- 🔌 **Easy Integration**: Simple script tag integration
- 🚀 **TypeScript**: Full TypeScript support with type definitions
- 📦 **Standalone**: Single file bundle with no external dependencies

## Quick Start

### Script Tag Integration (Recommended)

Add the widget to your HTML page using a script tag:

```html
<script src="path/to/meet.js" 
        marketrix-id="your-marketrix-id" 
        marketrix-key="your-marketrix-key">
</script>
```

### Configuration Options

You can customize the widget using data attributes:

```html
<script src="path/to/meet.js" 
        marketrix-id="your-marketrix-id" 
        marketrix-key="your-marketrix-key"
        data-position="bottom-right"
        data-theme="light"
        data-agent-name="Support Agent">
</script>
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

5. Build with demos and source files:
```bash
npm run build:full
```

### Project Structure

```
widget/
├── src/
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── index.css           # Global styles
│   └── index.tsx           # Main entry point
├── vite.config.ts          # Vite configuration
├── build.js                # Build script
├── deploy.js               # Deployment script
└── dist/                   # Build output
    ├── meet.js             # Main widget bundle
    ├── index.html          # Demo page
    └── INTEGRATION_GUIDE.md # Integration guide
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
