/**
 * Show Mode Service
 * Handles highlighting elements, showing overlays/popups, and waiting for user action
 * in show mode before executing tool actions.
 */

export interface ShowModeOptions {
  element: HTMLElement;
  explanation: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  isClickAction?: boolean; // true for click actions, false for keyboard actions
}

let currentOverlay: HTMLElement | null = null;
let currentPopup: HTMLElement | null = null;
let currentHighlight: HTMLElement | null = null;
let resolvePromise: ((value: boolean) => void) | null = null;

/**
 * Show mode overlay: highlight element, show popup, wait for user action
 */
export async function showToolAction(options: ShowModeOptions): Promise<boolean> {
  const {
    element,
    explanation,
    isClickAction = false,
    toolName: _toolName,
    toolParams: _toolParams,
  } = options;

  // Clean up any existing overlay
  cleanup();

  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait for scroll to complete
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Get element position
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'marketrix-show-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999998;
    pointer-events: auto;
  `;
  document.body.appendChild(overlay);
  currentOverlay = overlay;

  // Highlight element
  const highlight = document.createElement('div');
  highlight.id = 'marketrix-show-highlight';
  const highlightRect = {
    top: rect.top + scrollY,
    left: rect.left + scrollX,
    width: rect.width,
    height: rect.height,
  };
  highlight.style.cssText = `
    position: absolute;
    top: ${highlightRect.top}px;
    left: ${highlightRect.left}px;
    width: ${highlightRect.width}px;
    height: ${highlightRect.height}px;
    border: 3px solid #3b82f6;
    border-radius: 4px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.4);
    z-index: 999999;
    pointer-events: none;
    transition: all 0.2s ease;
  `;
  document.body.appendChild(highlight);
  currentHighlight = highlight;

  // Create popup
  const popup = document.createElement('div');
  popup.id = 'marketrix-show-popup';

  // Position popup near element (prefer right side, fallback to left)
  const popupWidth = 320;
  const popupHeight = 120;
  let popupLeft = highlightRect.left + highlightRect.width + 20;
  let popupTop = highlightRect.top;

  // Adjust if popup would go off screen
  if (popupLeft + popupWidth > window.innerWidth) {
    popupLeft = highlightRect.left - popupWidth - 20;
  }
  if (popupTop + popupHeight > window.innerHeight) {
    popupTop = window.innerHeight - popupHeight - 20;
  }
  if (popupTop < 0) {
    popupTop = 20;
  }

  popup.style.cssText = `
    position: absolute;
    top: ${popupTop}px;
    left: ${popupLeft}px;
    width: ${popupWidth}px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000000;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #333;
  `;

  // Popup content - different for click vs keyboard actions
  if (isClickAction) {
    // Click actions: No button, just explanation - clicking element completes action
    popup.innerHTML = `
      <div style="font-weight: 500; color: #1f2937;">
        ${escapeHtml(explanation)}
      </div>
    `;
  } else {
    // Keyboard actions: Show Continue button
    popup.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: 500; color: #1f2937;">
        ${escapeHtml(explanation)}
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="marketrix-show-continue" style="
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        ">Continue</button>
      </div>
    `;
  }
  document.body.appendChild(popup);
  currentPopup = popup;

  // For keyboard actions: Add Continue button handler
  if (!isClickAction) {
    const continueButton = popup.querySelector('#marketrix-show-continue') as HTMLButtonElement;
    if (continueButton) {
      continueButton.addEventListener('mouseenter', () => {
        continueButton.style.background = '#2563eb';
      });
      continueButton.addEventListener('mouseleave', () => {
        continueButton.style.background = '#3b82f6';
      });
      continueButton.addEventListener('click', () => {
        resolvePromise?.(true);
      });
    }
  }

  // Element click completes the action (for both click and keyboard actions)
  const handleElementClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resolvePromise?.(true);
  };
  element.addEventListener('click', handleElementClick, { once: true });

  // Wait for user action
  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  }).finally(() => {
    cleanup();
  });
}

/**
 * Clean up overlay, popup, and highlight
 */
export function cleanup(): void {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  if (currentHighlight) {
    currentHighlight.remove();
    currentHighlight = null;
  }
  resolvePromise = null;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
