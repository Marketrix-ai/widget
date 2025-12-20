/**
 * Marketrix Widget Content Script
 *
 * This runs on every page and checks if widget injection is enabled.
 * If enabled, it injects the widget script automatically.
 *
 * Uses a delayed injection to avoid conflicts with page initialization scripts.
 */

const SCRIPT_ID = 'marketrix-widget-script';

function isWidgetPresent() {
  return !!(
    document.getElementById(SCRIPT_ID) ||
    document.querySelector('script[mtx-id], script[mtx-app]') ||
    document.getElementById('marketrix-widget-container')
  );
}

function injectWidget(config) {
  if (isWidgetPresent()) return;

  try {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = config.scriptSrc;

    if (config.mtxAgent) {
      script.setAttribute('mtx-agent', config.mtxAgent);
    }
    if (config.mtxApp) {
      script.setAttribute('mtx-app', config.mtxApp);
    }
    if (config.mtxId) {
      script.setAttribute('mtx-id', config.mtxId);
    }
    if (config.mtxKey) {
      script.setAttribute('mtx-key', config.mtxKey);
    }
    if (config.mtxApiHost) {
      script.setAttribute('mtx-api-host', config.mtxApiHost);
    }
    if (config.mtxAiHost) {
      script.setAttribute('mtx-ai-host', config.mtxAiHost);
    }

    // Append to body instead of head to avoid conflicts with head-modifying scripts
    const target = document.body || document.head || document.documentElement;
    if (target) {
      target.appendChild(script);
    }
  } catch (e) {
    console.warn('[Marketrix] Failed to inject widget:', e);
  }
}

// Delayed injection to let page scripts initialize first
function injectWidgetDelayed(config) {
  // Wait for DOM to be ready, then add extra delay for page scripts
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        setTimeout(() => injectWidget(config), 500);
      },
      { once: true }
    );
  } else {
    // DOM already ready, but still delay to avoid race conditions
    setTimeout(() => injectWidget(config), 100);
  }
}

// Check storage and inject if enabled (with delay)
chrome.storage.local.get(['enabled', 'config'], (result) => {
  if (result.enabled && result.config) {
    injectWidgetDelayed(result.config);
  }
});

// Listen for messages from popup to enable/disable
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'inject') {
    // Immediate injection when user clicks enable
    injectWidget(message.config);
    sendResponse({ success: true });
  } else if (message.action === 'remove') {
    const container = document.getElementById('marketrix-widget-container');
    const script = document.getElementById(SCRIPT_ID);
    if (container) container.remove();
    if (script) script.remove();
    sendResponse({ success: true });
  }
});
