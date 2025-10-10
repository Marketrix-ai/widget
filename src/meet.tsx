import { initMarketrixWidget, MarketrixConfig } from './index';
import './index.css';

// Demo configuration
const demoConfig: MarketrixConfig = {
  marketrixId: 'demo-marketrix-id',
  marketrixKey: 'demo-marketrix-key',
  position: 'bottom-right',
  theme: 'light',
  avatarUrl: 'https://via.placeholder.com/64/0ea5e9/ffffff?text=AI',
  agentName: 'Demo Agent',
  enabledModes: ['show', 'tell', 'do']
};

// Override the ConfigManager to use embedded config instead of fetching
import { configManager } from './utils/ConfigManager';

// Mock configuration for the widget
const mockConfig = {
    session_time: 0,
    sessionActive: true,
    recorded_time: 0,
    recordActive: false,
    widget_text: {
      greeting: "🎉 Welcome! I'm your AI assistant!",
      placeholder: "Ask me anything...",
      header_ai: "🤖 AI Assistant",
      header_live: "👨‍💼 Live Agent",
      body_ai: "I'm here to help you with any questions or tasks.",
      body_live: "A live agent will be with you shortly.",
      chat_greeting: "Hi there! How can I help you today?",
      tour_greeting: "Welcome! Let me show you around."
    },
    widget_type: "hybrid",
    widget_visible: true,
    widget_customize: {
      colors: {
        primary: "#1BB55B",
        secondary: "#987ADD",
        background: "linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)",
        text: "#333333",
        border: "rgba(255, 255, 255, 0.2)"
      },
      sizes: {
        width: "360px",
        height: "35rem",
        border_radius: "12px",
        font_size: "14px"
      },
      animations: {
        slide_duration: "300ms",
        fade_duration: "200ms",
        bounce_effect: true
      }
    },
    active_avatar: {
      url: "https://via.placeholder.com/64/0ea5e9/ffffff?text=AI",
      name: "🤖 AI Helper",
      status: "online"
    },
    avatar_trigger_time: 5000,
    enable_widget_popup: true,
    avatar_status: "online",
    widget_mode: "ai",
    mLive_form: {
      enabled: true,
      fields: ["name", "email", "message"],
      required: ["name", "email"]
    },
    hybrid_agents_on: true,
    hybrid_agents_off: false,
    widget_visible_device: {
      desktop: true,
      tablet: true,
      mobile: true
    },
    streaming_avatar_status: "idle",
    widget_position: {
      position: "bottom-right",
      offset: {
        x: 20,
        y: 20
      },
      z_index: 40
    },
    enable_ai_tour: true,
    widget_header_ai: "AI Assistant",
    widget_body_ai: "I'm here to help you with any questions or tasks.",
    widget_header_live: "Live Agent",
    widget_body_live: "A live agent will be with you shortly.",
    widget_chat_greeting: "Welcome to our chat! How can I assist you?",
    widget_tour_greeting: "Welcome! Let me show you around.",
    inapp_login_url: "https://app.marketrix.com/login",
    inapp_login_id: "user123",
    inapp_login_password: "encrypted_password_hash",
    advanced_settings: {
      auto_open_delay: 0,
      session_timeout: 1800000,
      max_messages: 100,
      typing_indicator: true,
      read_receipts: true,
      sound_notifications: true,
      vibration_enabled: true
    },
    themes: {
      light: {
        background: "#ffffff",
        text: "#333333",
        border: "#e5e7eb",
        accent: "#1BB55B"
      },
      dark: {
        background: "#1f2937",
        text: "#f9fafb",
        border: "#374151",
        accent: "#10b981"
      }
    },
    responsive_breakpoints: {
      mobile: "768px",
      tablet: "1024px",
      desktop: "1200px"
    }
  };

// Mock the loadConfig method to return embedded config
configManager.loadConfig = async () => {
  return mockConfig;
};

// Initialize the config manager with our mock config immediately
configManager.updateConfig(mockConfig);

// Also ensure the config is set synchronously
Object.defineProperty(configManager, 'config', {
  value: mockConfig,
  writable: true
});

// Override the shouldShowWidget method to always return true for our demo
configManager.shouldShowWidget = () => true;

// Inject CSS styles into the page
function injectStyles() {
  const cssContent = `*,:before,:after{--tw-border-spacing-x: 0;--tw-border-spacing-y: 0;--tw-translate-x: 0;--tw-translate-y: 0;--tw-rotate: 0;--tw-skew-x: 0;--tw-skew-y: 0;--tw-scale-x: 1;--tw-scale-y: 1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness: proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width: 0px;--tw-ring-offset-color: #fff;--tw-ring-color: rgb(59 130 246 / .5);--tw-ring-offset-shadow: 0 0 #0000;--tw-ring-shadow: 0 0 #0000;--tw-shadow: 0 0 #0000;--tw-shadow-colored: 0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }::backdrop{--tw-border-spacing-x: 0;--tw-border-spacing-y: 0;--tw-translate-x: 0;--tw-translate-y: 0;--tw-rotate: 0;--tw-skew-x: 0;--tw-skew-y: 0;--tw-scale-x: 1;--tw-scale-y: 1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness: proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width: 0px;--tw-ring-offset-color: #fff;--tw-ring-color: rgb(59 130 246 / .5);--tw-ring-offset-shadow: 0 0 #0000;--tw-ring-shadow: 0 0 #0000;--tw-shadow: 0 0 #0000;--tw-shadow-colored: 0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }*,:before,:after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e5e7eb}:before,:after{--tw-content: ""}html,:host{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;-o-tab-size:4;tab-size:4;font-family:ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji";font-feature-settings:normal;font-variation-settings:normal;-webkit-tap-highlight-color:transparent}body{margin:0;line-height:inherit}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,samp,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-feature-settings:normal;font-variation-settings:normal;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}button,input,optgroup,select,textarea{font-family:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-size:100%;font-weight:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;margin:0;padding:0}button,select{text-transform:none}button,input:where([type=button]),input:where([type=reset]),input:where([type=submit]){-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dl,dd,h1,h2,h3,h4,h5,h6,hr,figure,p,pre{margin:0}fieldset{margin:0;padding:0}legend{padding:0}ol,ul,menu{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::-moz-placeholder,textarea::-moz-placeholder{opacity:1;color:#9ca3af}input::placeholder,textarea::placeholder{opacity:1;color:#9ca3af}button,[role=button]{cursor:pointer}:disabled{cursor:default}img,svg,video,canvas,audio,iframe,embed,object{display:block;vertical-align:middle}img,video{max-width:100%;height:auto}[hidden]:where(:not([hidden=until-found])){display:none}.marketrix-widget{font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}.marketrix-widget-container{position:fixed;z-index:999999;pointer-events:none}.marketrix-widget-container *{pointer-events:auto}.marketrix-widget *{transition:all .2s ease-in-out}.gradient-border{border:2px solid;-o-border-image:linear-gradient(to right,#8b5cf6,#10b981) 1;border-image:linear-gradient(to right,#8b5cf6,#10b981) 1}@keyframes fade-in{0%{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in{animation:fade-in .5s ease-out}@keyframes slide-in-left{0%{opacity:0;transform:translate(-30px) translateY(-50%)}to{opacity:1;transform:translate(0) translateY(-50%)}}.animate-slide-in-left{animation:slide-in-left .6s ease-out}.pointer-events-none{pointer-events:none}.visible{visibility:visible}.static{position:static}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.inset-0{top:0;right:0;bottom:0;left:0}.-right-1{right:-.25rem}.-top-1{top:-.25rem}.bottom-16{bottom:4rem}.bottom-20{bottom:5rem}.bottom-4{bottom:1rem}.left-0{left:0}.left-1\/2{left:50%}.left-16{left:4rem}.left-4{left:1rem}.right-0{right:0}.right-2{right:.5rem}.right-4{right:1rem}.right-full{right:100%}.top-1\/2{top:50%}.top-16{top:4rem}.top-2{top:.5rem}.top-20{top:5rem}.top-4{top:1rem}.top-full{top:100%}.z-50{z-index:50}.z-\[10003\]{z-index:10003}.z-\[9999\]{z-index:9999}.m-3{margin:.75rem}.mx-3{margin-left:.75rem;margin-right:.75rem}.mx-4{margin-left:1rem;margin-right:1rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mb-5{margin-bottom:1.25rem}.mb-6{margin-bottom:1.5rem}.ml-4{margin-left:1rem}.mt-1\.5{margin-top:.375rem}.block{display:block}.inline{display:inline}.flex{display:flex}.inline-flex{display:inline-flex}.hidden{display:none}.h-0{height:0px}.h-12{height:3rem}.h-14{height:3.5rem}.h-2{height:.5rem}.h-3{height:.75rem}.h-4{height:1rem}.h-5{height:1.25rem}.h-6{height:1.5rem}.h-8{height:2rem}.h-\[35rem\]{height:35rem}.h-full{height:100%}.w-0{width:0px}.w-12{width:3rem}.w-14{width:3.5rem}.w-2{width:.5rem}.w-3{width:.75rem}.w-4{width:1rem}.w-5{width:1.25rem}.w-6{width:1.5rem}.w-64{width:16rem}.w-8{width:2rem}.w-\[360px\]{width:360px}.w-fit{width:-moz-fit-content;width:fit-content}.w-full{width:100%}.max-w-md{max-width:28rem}.max-w-sm{max-width:24rem}.flex-1{flex:1 1 0%}.flex-shrink-0{flex-shrink:0}.-translate-x-1\/2{--tw-translate-x: -50%;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.-translate-x-64{--tw-translate-x: -16rem;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.-translate-y-1\/2{--tw-translate-y: -50%;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.scale-0{--tw-scale-x: 0;--tw-scale-y: 0;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.scale-100{--tw-scale-x: 1;--tw-scale-y: 1;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.transform{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.transform-gpu{transform:translate3d(var(--tw-translate-x),var(--tw-translate-y),0) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}@keyframes bounce{0%,to{transform:translateY(-25%);animation-timing-function:cubic-bezier(.8,0,1,1)}50%{transform:none;animation-timing-function:cubic-bezier(0,0,.2,1)}}.animate-bounce{animation:bounce 1s infinite}@keyframes pulse{50%{opacity:.5}}.animate-pulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite}@keyframes slideDown{0%{transform:translateY(0) scale(1);opacity:1}to{transform:translateY(100%) scale(.8);opacity:0}}.animate-slide-down{animation:slideDown .3s ease-out}@keyframes slideUp{0%{transform:translateY(100%) scale(.8);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}.animate-slide-up{animation:slideUp .3s ease-out}.cursor-not-allowed{cursor:not-allowed}.cursor-pointer{cursor:pointer}.resize-none{resize:none}.flex-col{flex-direction:column}.items-center{align-items:center}.justify-start{justify-content:flex-start}.justify-end{justify-content:flex-end}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.space-x-1>:not([hidden])~:not([hidden]){--tw-space-x-reverse: 0;margin-right:calc(.25rem * var(--tw-space-x-reverse));margin-left:calc(.25rem * calc(1 - var(--tw-space-x-reverse)))}.space-x-2>:not([hidden])~:not([hidden]){--tw-space-x-reverse: 0;margin-right:calc(.5rem * var(--tw-space-x-reverse));margin-left:calc(.5rem * calc(1 - var(--tw-space-x-reverse)))}.space-y-2>:not([hidden])~:not([hidden]){--tw-space-y-reverse: 0;margin-top:calc(.5rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.5rem * var(--tw-space-y-reverse))}.space-y-3>:not([hidden])~:not([hidden]){--tw-space-y-reverse: 0;margin-top:calc(.75rem * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.75rem * var(--tw-space-y-reverse))}.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.whitespace-nowrap{white-space:nowrap}.whitespace-pre-wrap{white-space:pre-wrap}.break-words{overflow-wrap:break-word}.rounded{border-radius:.25rem}.rounded-2xl{border-radius:1rem}.rounded-\[27px\]{border-radius:27px}.rounded-full{border-radius:9999px}.rounded-lg{border-radius:.5rem}.rounded-b-md{border-bottom-right-radius:.375rem;border-bottom-left-radius:.375rem}.rounded-l-md{border-top-left-radius:.375rem;border-bottom-left-radius:.375rem}.border{border-width:1px}.border-2{border-width:2px}.border-b-4{border-bottom-width:4px}.border-l-4{border-left-width:4px}.border-r-4{border-right-width:4px}.border-t-4{border-top-width:4px}.border-gray-200{--tw-border-opacity: 1;border-color:rgb(229 231 235 / var(--tw-border-opacity, 1))}.border-gray-600{--tw-border-opacity: 1;border-color:rgb(75 85 99 / var(--tw-border-opacity, 1))}.border-purple-200{--tw-border-opacity: 1;border-color:rgb(233 213 255 / var(--tw-border-opacity, 1))}.border-transparent{border-color:transparent}.border-white{--tw-border-opacity: 1;border-color:rgb(255 255 255 / var(--tw-border-opacity, 1))}.border-r-white{--tw-border-opacity: 1;border-right-color:rgb(255 255 255 / var(--tw-border-opacity, 1))}.border-t-gray-900{--tw-border-opacity: 1;border-top-color:rgb(17 24 39 / var(--tw-border-opacity, 1))}.bg-\[\#101828\]{--tw-bg-opacity: 1;background-color:rgb(16 24 40 / var(--tw-bg-opacity, 1))}.bg-\[\#6941C6\]{--tw-bg-opacity: 1;background-color:rgb(105 65 198 / var(--tw-bg-opacity, 1))}.bg-\[\#E7DDFF\]{--tw-bg-opacity: 1;background-color:rgb(231 221 255 / var(--tw-bg-opacity, 1))}.bg-black{--tw-bg-opacity: 1;background-color:rgb(0 0 0 / var(--tw-bg-opacity, 1))}.bg-gray-200{--tw-bg-opacity: 1;background-color:rgb(229 231 235 / var(--tw-bg-opacity, 1))}.bg-gray-800{--tw-bg-opacity: 1;background-color:rgb(31 41 55 / var(--tw-bg-opacity, 1))}.bg-gray-900{--tw-bg-opacity: 1;background-color:rgb(17 24 39 / var(--tw-bg-opacity, 1))}.bg-green-500{--tw-bg-opacity: 1;background-color:rgb(34 197 94 / var(--tw-bg-opacity, 1))}.bg-purple-100{--tw-bg-opacity: 1;background-color:rgb(243 232 255 / var(--tw-bg-opacity, 1))}.bg-purple-600{--tw-bg-opacity: 1;background-color:rgb(147 51 234 / var(--tw-bg-opacity, 1))}.bg-red-500{--tw-bg-opacity: 1;background-color:rgb(239 68 68 / var(--tw-bg-opacity, 1))}.bg-transparent{background-color:transparent}.bg-white{--tw-bg-opacity: 1;background-color:rgb(255 255 255 / var(--tw-bg-opacity, 1))}.bg-opacity-50{--tw-bg-opacity: .5}.bg-gradient-to-r{background-image:linear-gradient(to right,var(--tw-gradient-stops))}.from-\[\#B398F6\]{--tw-gradient-from: #B398F6 var(--tw-gradient-from-position);--tw-gradient-to: rgb(179 152 246 / 0) var(--tw-gradient-to-position);--tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to)}.from-green-400{--tw-gradient-from: #4ade80 var(--tw-gradient-from-position);--tw-gradient-to: rgb(74 222 128 / 0) var(--tw-gradient-to-position);--tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to)}.to-\[\#5CF2B5\]{--tw-gradient-to: #5CF2B5 var(--tw-gradient-to-position)}.to-purple-500{--tw-gradient-to: #a855f7 var(--tw-gradient-to-position)}.object-cover{-o-object-fit:cover;object-fit:cover}.p-0\.5{padding:.125rem}.p-1{padding:.25rem}.p-2{padding:.5rem}.p-3{padding:.75rem}.px-2{padding-left:.5rem;padding-right:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}.px-5{padding-left:1.25rem;padding-right:1.25rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}.py-0\.5{padding-top:.125rem;padding-bottom:.125rem}.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.pb-2{padding-bottom:.5rem}.pr-2{padding-right:.5rem}.text-left{text-align:left}.text-center{text-align:center}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-xs{font-size:.75rem;line-height:1rem}.font-bold{font-weight:700}.font-medium{font-weight:500}.font-normal{font-weight:400}.font-semibold{font-weight:600}.leading-relaxed{line-height:1.625}.text-\[\#1D2939\]{--tw-text-opacity: 1;color:rgb(29 41 57 / var(--tw-text-opacity, 1))}.text-\[\#667085\]{--tw-text-opacity: 1;color:rgb(102 112 133 / var(--tw-text-opacity, 1))}.text-\[\#6941C6\]{--tw-text-opacity: 1;color:rgb(105 65 198 / var(--tw-text-opacity, 1))}.text-black{--tw-text-opacity: 1;color:rgb(0 0 0 / var(--tw-text-opacity, 1))}.text-gray-400{--tw-text-opacity: 1;color:rgb(156 163 175 / var(--tw-text-opacity, 1))}.text-gray-500{--tw-text-opacity: 1;color:rgb(107 114 128 / var(--tw-text-opacity, 1))}.text-gray-600{--tw-text-opacity: 1;color:rgb(75 85 99 / var(--tw-text-opacity, 1))}.text-gray-800{--tw-text-opacity: 1;color:rgb(31 41 55 / var(--tw-text-opacity, 1))}.text-gray-900{--tw-text-opacity: 1;color:rgb(17 24 39 / var(--tw-text-opacity, 1))}.text-purple-100{--tw-text-opacity: 1;color:rgb(243 232 255 / var(--tw-text-opacity, 1))}.text-white{--tw-text-opacity: 1;color:rgb(255 255 255 / var(--tw-text-opacity, 1))}.placeholder-gray-400::-moz-placeholder{--tw-placeholder-opacity: 1;color:rgb(156 163 175 / var(--tw-placeholder-opacity, 1))}.placeholder-gray-400::placeholder{--tw-placeholder-opacity: 1;color:rgb(156 163 175 / var(--tw-placeholder-opacity, 1))}.opacity-0{opacity:0}.opacity-100{opacity:1}.shadow-2xl{--tw-shadow: 0 25px 50px -12px rgb(0 0 0 / .25);--tw-shadow-colored: 0 25px 50px -12px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000),var(--tw-ring-shadow, 0 0 #0000),var(--tw-shadow)}.shadow-lg{--tw-shadow: 0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1);--tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000),var(--tw-ring-shadow, 0 0 #0000),var(--tw-shadow)}.shadow-sm{--tw-shadow: 0 1px 2px 0 rgb(0 0 0 / .05);--tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000),var(--tw-ring-shadow, 0 0 #0000),var(--tw-shadow)}.shadow-xl{--tw-shadow: 0 20px 25px -5px rgb(0 0 0 / .1), 0 8px 10px -6px rgb(0 0 0 / .1);--tw-shadow-colored: 0 20px 25px -5px var(--tw-shadow-color), 0 8px 10px -6px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000),var(--tw-ring-shadow, 0 0 #0000),var(--tw-shadow)}.filter{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.backdrop-blur-sm{--tw-backdrop-blur: blur(4px);-webkit-backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}.transition-all{transition-property:all;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-opacity{transition-property:opacity;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.duration-200{transition-duration:.2s}.duration-300{transition-duration:.3s}.duration-500{transition-duration:.5s}.ease-in-out{transition-timing-function:cubic-bezier(.4,0,.2,1)}.hover\:scale-110:hover{--tw-scale-x: 1.1;--tw-scale-y: 1.1;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.hover\:bg-gray-50:hover{--tw-bg-opacity: 1;background-color:rgb(249 250 251 / var(--tw-bg-opacity, 1))}.hover\:bg-gray-700:hover{--tw-bg-opacity: 1;background-color:rgb(55 65 81 / var(--tw-bg-opacity, 1))}.hover\:bg-purple-200:hover{--tw-bg-opacity: 1;background-color:rgb(233 213 255 / var(--tw-bg-opacity, 1))}.hover\:bg-white:hover{--tw-bg-opacity: 1;background-color:rgb(255 255 255 / var(--tw-bg-opacity, 1))}.hover\:text-red-100:hover{--tw-text-opacity: 1;color:rgb(254 226 226 / var(--tw-text-opacity, 1))}.hover\:shadow-md:hover{--tw-shadow: 0 4px 6px -1px rgb(0 0 0 / .1), 0 2px 4px -2px rgb(0 0 0 / .1);--tw-shadow-colored: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000),var(--tw-ring-shadow, 0 0 #0000),var(--tw-shadow)}.focus\:outline-none:focus{outline:2px solid transparent;outline-offset:2px}.focus\:ring-2:focus{--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow, 0 0 #0000)}.focus\:ring-4:focus{--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(4px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow, 0 0 #0000)}.focus\:ring-green-500\/20:focus{--tw-ring-color: rgb(34 197 94 / .2)}.focus\:ring-marketrix-500\/20:focus{--tw-ring-color: rgb(34 197 94 / .2)}.disabled\:cursor-not-allowed:disabled{cursor:not-allowed}.disabled\:opacity-50:disabled{opacity:.5}.group:hover .group-hover\:opacity-100{opacity:1}@media (prefers-color-scheme: dark){.dark\:border-gray-700{--tw-border-opacity: 1;border-color:rgb(55 65 81 / var(--tw-border-opacity, 1))}.dark\:bg-gray-800{--tw-bg-opacity: 1;background-color:rgb(31 41 55 / var(--tw-bg-opacity, 1))}}`;

  // Check if styles are already injected
  if (document.getElementById('marketrix-widget-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'marketrix-widget-styles';
  style.textContent = cssContent;
  document.head.appendChild(style);
}

// Auto-initialize the widget when script loads
(function() {
  // Inject CSS first
  injectStyles();
  
  // Check if the widget is already loaded
  if (document.getElementById('marketrix-widget-container')) {
    return;
  }

  // Add debug logging
  console.log('About to initialize widget with config:', demoConfig);
  console.log('ConfigManager shouldShowWidget:', configManager.shouldShowWidget());
  console.log('ConfigManager config:', configManager.getConfig());

  // Initialize the widget using the proper function
  initMarketrixWidget(demoConfig);
  
  // Add more debug logging after initialization
  setTimeout(() => {
    const container = document.getElementById('marketrix-widget-container');
    console.log('Widget container after init:', container);
    console.log('Container children:', container?.children.length);
    console.log('Container innerHTML:', container?.innerHTML);
  }, 1000);

  console.log('Marketrix Widget (Meet Mode) initialized successfully');
})();
