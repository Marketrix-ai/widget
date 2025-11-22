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

let currentPopup: HTMLElement | null = null;
let currentHighlight: HTMLElement | null = null;
let currentElement: HTMLElement | null = null;
let resolvePromise: ((value: boolean) => void) | null = null;
let clickHandler: ((e: MouseEvent) => void) | null = null;
let updateHighlightPosition: (() => void) | null = null;
let scrollHandler: (() => void) | null = null;
let rafId: number | null = null;

/**
 * Calculate a score for a popup position based on how much of it is visible on screen.
 * Higher score = better position (more visible).
 */
function calculatePositionScore(
  left: number,
  top: number,
  width: number,
  height: number,
  padding: number
): number {
  const right = left + width;
  const bottom = top + height;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Calculate visible area
  const visibleLeft = Math.max(padding, Math.min(left, screenWidth - padding));
  const visibleTop = Math.max(padding, Math.min(top, screenHeight - padding));
  const visibleRight = Math.min(screenWidth - padding, Math.max(right, padding));
  const visibleBottom = Math.min(screenHeight - padding, Math.max(bottom, padding));

  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = width * height;

  // Score is the percentage of popup that's visible, with bonus for being fully on screen
  const visibilityScore = totalArea > 0 ? visibleArea / totalArea : 0;
  const fullyVisibleBonus = visibleWidth === width && visibleHeight === height ? 0.2 : 0;

  return visibilityScore + fullyVisibleBonus;
}

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

  // Store element reference
  currentElement = element;

  // Scroll element into view (instant, no animation)
  element.scrollIntoView({ behavior: 'auto', block: 'center' });

  // Get element position
  const rect = element.getBoundingClientRect();

  // Highlight element with border (non-interactive, just visual)
  const highlight = document.createElement('div');
  highlight.id = 'marketrix-show-highlight';
  highlight.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 3px solid #3b82f6;
    border-radius: 4px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.4);
    z-index: 2147483646;
    pointer-events: none;
    transition: none;
  `;
  document.body.appendChild(highlight);
  currentHighlight = highlight;

  // Update highlight and popup position on scroll/resize
  updateHighlightPosition = () => {
    if (!currentElement || !currentHighlight) return;
    const newRect = currentElement.getBoundingClientRect();
    // Update instantly without transition
    currentHighlight.style.transition = 'none';
    currentHighlight.style.top = `${newRect.top}px`;
    currentHighlight.style.left = `${newRect.left}px`;
    currentHighlight.style.width = `${newRect.width}px`;
    currentHighlight.style.height = `${newRect.height}px`;

    // Update popup position to stay attached to element
    if (currentPopup && currentElement) {
      const popupWidth = 320;
      const popupHeight = 120;
      const spacing = 20;
      const padding = 10;

      // Recalculate best position
      const elementCenterX = newRect.left + newRect.width / 2;
      const elementCenterY = newRect.top + newRect.height / 2;

      const positionOptions = [
        {
          left: newRect.right + spacing,
          top: elementCenterY - popupHeight / 2,
          side: 'right' as const,
        },
        {
          left: newRect.left - popupWidth - spacing,
          top: elementCenterY - popupHeight / 2,
          side: 'left' as const,
        },
        {
          left: elementCenterX - popupWidth / 2,
          top: newRect.top - popupHeight - spacing,
          side: 'top' as const,
        },
        {
          left: elementCenterX - popupWidth / 2,
          top: newRect.bottom + spacing,
          side: 'bottom' as const,
        },
      ].map((opt) => ({
        ...opt,
        score: calculatePositionScore(opt.left, opt.top, popupWidth, popupHeight, padding),
      }));

      const bestOption = positionOptions.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      const popupLeft = Math.max(
        padding,
        Math.min(bestOption.left, window.innerWidth - popupWidth - padding)
      );
      const popupTop = Math.max(
        padding,
        Math.min(bestOption.top, window.innerHeight - popupHeight - padding)
      );

      // Update popup position instantly without transition
      currentPopup.style.transition = 'none';
      currentPopup.style.top = `${popupTop}px`;
      currentPopup.style.left = `${popupLeft}px`;

      // Update arrow position based on new popup position
      const isPopupOnRight = popupLeft > newRect.left;
      const isPopupOnLeft = popupLeft + popupWidth < newRect.left;
      const isPopupOnTop = popupTop + popupHeight < newRect.top;
      const isPopupOnBottom = popupTop > newRect.bottom;

      let arrowStyle = '';
      if (isPopupOnRight) {
        arrowStyle = `
          position: absolute;
          left: -8px;
          top: 20px;
          width: 0;
          height: 0;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-right: 8px solid white;
          filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.1));
        `;
      } else if (isPopupOnLeft) {
        arrowStyle = `
          position: absolute;
          right: -8px;
          top: 20px;
          width: 0;
          height: 0;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-left: 8px solid white;
          filter: drop-shadow(2px 0 2px rgba(0, 0, 0, 0.1));
        `;
      } else if (isPopupOnTop) {
        arrowStyle = `
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 8px solid white;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
        `;
      } else if (isPopupOnBottom) {
        arrowStyle = `
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid white;
          filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.1));
        `;
      }

      // Update arrow if it exists
      const arrow = currentPopup.querySelector('[data-arrow]') as HTMLElement;
      if (arrow && arrowStyle) {
        arrow.style.cssText = arrowStyle;
      }
    }
  };

  // Update position instantly on scroll/resize (no RAF delay)
  const handleScroll = () => {
    // Cancel any pending RAF to avoid delays
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    // Update immediately
    if (updateHighlightPosition) {
      updateHighlightPosition();
    }
  };

  scrollHandler = handleScroll;
  // Listen to scroll events with capture phase for immediate updates
  window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
  window.addEventListener('resize', handleScroll, { passive: true });
  // Also listen to touchmove for touch scrolling
  window.addEventListener('touchmove', handleScroll, { passive: true });
  // Listen to wheel events for mouse wheel scrolling
  window.addEventListener('wheel', handleScroll, { passive: true });

  // Create popup
  const popup = document.createElement('div');
  popup.id = 'marketrix-show-popup';

  // Smart positioning: try multiple positions and pick the best one
  const popupWidth = 320;
  const popupHeight = 120;
  const spacing = 20;
  const padding = 10; // Minimum distance from screen edges

  // Calculate element center
  const elementCenterX = rect.left + rect.width / 2;
  const elementCenterY = rect.top + rect.height / 2;

  // Try different positions and score them based on visibility
  type PositionOption = {
    left: number;
    top: number;
    side: 'right' | 'left' | 'top' | 'bottom';
    score: number;
  };

  const positionOptions: PositionOption[] = [];

  // Right side
  const rightLeft = rect.right + spacing;
  const rightTop = elementCenterY - popupHeight / 2;
  const rightScore = calculatePositionScore(rightLeft, rightTop, popupWidth, popupHeight, padding);
  positionOptions.push({ left: rightLeft, top: rightTop, side: 'right', score: rightScore });

  // Left side
  const leftLeft = rect.left - popupWidth - spacing;
  const leftTop = elementCenterY - popupHeight / 2;
  const leftScore = calculatePositionScore(leftLeft, leftTop, popupWidth, popupHeight, padding);
  positionOptions.push({ left: leftLeft, top: leftTop, side: 'left', score: leftScore });

  // Top side
  const topLeft = elementCenterX - popupWidth / 2;
  const topTop = rect.top - popupHeight - spacing;
  const topScore = calculatePositionScore(topLeft, topTop, popupWidth, popupHeight, padding);
  positionOptions.push({ left: topLeft, top: topTop, side: 'top', score: topScore });

  // Bottom side
  const bottomLeft = elementCenterX - popupWidth / 2;
  const bottomTop = rect.bottom + spacing;
  const bottomScore = calculatePositionScore(
    bottomLeft,
    bottomTop,
    popupWidth,
    popupHeight,
    padding
  );
  positionOptions.push({ left: bottomLeft, top: bottomTop, side: 'bottom', score: bottomScore });

  // Pick the best position (highest score)
  const bestOption = positionOptions.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  // Adjust position to keep it on screen
  const popupLeft = Math.max(
    padding,
    Math.min(bestOption.left, window.innerWidth - popupWidth - padding)
  );
  const popupTop = Math.max(
    padding,
    Math.min(bestOption.top, window.innerHeight - popupHeight - padding)
  );

  // Determine arrow position and style based on which side the popup is on
  const isPopupOnRight = popupLeft > rect.left;
  const isPopupOnLeft = popupLeft + popupWidth < rect.left;
  const isPopupOnTop = popupTop + popupHeight < rect.top;
  const isPopupOnBottom = popupTop > rect.bottom;

  let arrowStyle = '';

  if (isPopupOnRight) {
    // Arrow on left side pointing right
    arrowStyle = `
      position: absolute;
      left: -8px;
      top: 20px;
      width: 0;
      height: 0;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-right: 8px solid white;
      filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.1));
    `;
  } else if (isPopupOnLeft) {
    // Arrow on right side pointing left
    arrowStyle = `
      position: absolute;
      right: -8px;
      top: 20px;
      width: 0;
      height: 0;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-left: 8px solid white;
      filter: drop-shadow(2px 0 2px rgba(0, 0, 0, 0.1));
    `;
  } else if (isPopupOnTop) {
    // Arrow on bottom pointing up
    arrowStyle = `
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid white;
      filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
    `;
  } else if (isPopupOnBottom) {
    // Arrow on top pointing down
    arrowStyle = `
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid white;
      filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.1));
    `;
  } else {
    // Default to right side if unclear
    arrowStyle = `
      position: absolute;
      left: -8px;
      top: 20px;
      width: 0;
      height: 0;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-right: 8px solid white;
      filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.1));
    `;
  }

  popup.style.cssText = `
    position: fixed;
    top: ${popupTop}px;
    left: ${popupLeft}px;
    width: ${popupWidth}px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    pointer-events: auto;
    transition: none;
  `;

  // Popup content - different for click vs keyboard actions
  if (isClickAction) {
    // Click actions: No button, just explanation - clicking element completes action
    popup.innerHTML = `
      <div data-arrow style="${arrowStyle}"></div>
      <div style="font-weight: 500; color: #1f2937; font-size: 12px;">
        ${escapeHtml(explanation)}
      </div>
    `;
  } else {
    // Keyboard actions: Show Continue button
    popup.innerHTML = `
      <div data-arrow style="${arrowStyle}"></div>
      <div style="margin-bottom: 12px; font-weight: 500; color: #1f2937; font-size: 12px;">
        ${escapeHtml(explanation)}
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="marketrix-show-continue" style="
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 12px;
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
      continueButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (resolvePromise) {
          const promise = resolvePromise;
          resolvePromise = null;
          promise(true);
        }
      });
    }
  }

  // Only register click handler for click actions
  // For non-click actions (like typing in input fields), user should interact freely
  // and then click Continue button
  if (isClickAction) {
    // Use event capturing on document to catch clicks regardless of z-index
    // This makes it robust against page-side z-index changes
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is on the element or its children
      if (element.contains(target) || element === target) {
        // For click actions, prevent the natural click - we'll trigger it programmatically
        // after cleanup to ensure proper tool execution
        e.stopPropagation();
        e.preventDefault();
        // Mark that user confirmed the action
        if (resolvePromise) {
          const promise = resolvePromise;
          resolvePromise = null;
          promise(true);
        }
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('click', handleDocumentClick, { capture: true, once: true });
    clickHandler = handleDocumentClick;
  }

  // Wait for user action
  return new Promise<boolean>((resolve) => {
    resolvePromise = (value: boolean) => {
      resolve(value);
    };
  }).finally(() => {
    cleanup();
  });
}

/**
 * Clean up popup, highlight, and event listeners
 */
export function cleanup(): void {
  if (clickHandler) {
    document.removeEventListener('click', clickHandler, { capture: true });
    clickHandler = null;
  }
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler, { capture: true });
    window.removeEventListener('resize', scrollHandler);
    window.removeEventListener('touchmove', scrollHandler);
    window.removeEventListener('wheel', scrollHandler);
    scrollHandler = null;
  }
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (updateHighlightPosition) {
    updateHighlightPosition = null;
  }
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  if (currentHighlight) {
    currentHighlight.remove();
    currentHighlight = null;
  }
  currentElement = null;
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
