/**
 * Element Highlight Service
 * Handles highlighting elements and showing tooltips for "show" mode questions.
 * Used when user asks questions like "Show me how to login" - finds the element,
 * highlights it, and shows a tooltip with instructions.
 */

import { domService } from './DomService';

export interface HighlightOptions {
  tooltipText?: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  highlightColor?: string;
  borderColor?: string;
  animation?: boolean;
}

let currentHighlight: {
  element: HTMLElement;
  tooltip: HTMLElement;
  overlay: HTMLElement;
} | null = null;

/**
 * Highlight an element by its data-id and show a tooltip.
 * @param dataId The data-id value of the element to highlight
 * @param options Highlight options (tooltip text, position, colors, etc.)
 * @returns true if element was found and highlighted, false otherwise
 */
export function highlightElementByDataId(
  dataId: number,
  options: HighlightOptions = {}
): boolean {
  // Clear any existing highlight first
  clearHighlight();

  // Get element by data-id
  const element = domService.getElementByDataId(dataId);
  if (!element || !(element instanceof HTMLElement)) {
    console.warn(`[ElementHighlight] Element with data-id="${dataId}" not found`);
    return false;
  }

  const tooltipText = options.tooltipText || 'Click this element';
  const tooltipPosition = options.tooltipPosition || 'top';
  const highlightColor = options.highlightColor || 'rgba(59, 130, 246, 0.2)';
  const borderColor = options.borderColor || 'rgba(59, 130, 246, 0.8)';

  // Create overlay for spotlight effect
  const overlay = document.createElement('div');
  overlay.id = 'element-highlight-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9998;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.3);
  `;

  // Get element position
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Create cutout for element (spotlight effect)
  const cutout = document.createElement('div');
  cutout.style.cssText = `
    position: absolute;
    top: ${rect.top + scrollY}px;
    left: ${rect.left + scrollX}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 3px solid ${borderColor};
    border-radius: 4px;
    box-shadow: 0 0 20px ${borderColor}, 0 0 40px ${borderColor};
    animation: highlightPulse 2s ease-in-out infinite;
  `;

  // Add pulse animation
  if (!document.getElementById('highlight-styles')) {
    const style = document.createElement('style');
    style.id = 'highlight-styles';
    style.textContent = `
      @keyframes highlightPulse {
        0%, 100% {
          box-shadow: 0 0 20px ${borderColor}, 0 0 40px ${borderColor};
          transform: scale(1);
        }
        50% {
          box-shadow: 0 0 30px ${borderColor}, 0 0 60px ${borderColor};
          transform: scale(1.02);
        }
      }
    `;
    document.head.appendChild(style);
  }

  overlay.appendChild(cutout);
  document.body.appendChild(overlay);

  // Add highlight class to element
  element.classList.add('element-highlight');
  element.style.cssText += `
    position: relative;
    z-index: 9999;
    background-color: ${highlightColor} !important;
    border: 2px solid ${borderColor} !important;
    border-radius: 4px;
    box-shadow: 0 0 15px ${borderColor} !important;
  `;

  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'element-highlight-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    z-index: 10000;
    background: rgba(15, 23, 42, 0.95);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 300px;
    pointer-events: none;
    animation: tooltipFadeIn 0.3s ease-out;
  `;
  tooltip.textContent = tooltipText;

  // Add tooltip animation
  if (!document.getElementById('tooltip-styles')) {
    const style = document.createElement('style');
    style.id = 'tooltip-styles';
    style.textContent = `
      @keyframes tooltipFadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Position tooltip
  const tooltipOffset = 15;
  let tooltipTop = 0;
  let tooltipLeft = 0;

  switch (tooltipPosition) {
    case 'top':
      tooltipTop = rect.top + scrollY - tooltip.offsetHeight - tooltipOffset;
      tooltipLeft = rect.left + scrollX + rect.width / 2 - tooltip.offsetWidth / 2;
      break;
    case 'bottom':
      tooltipTop = rect.bottom + scrollY + tooltipOffset;
      tooltipLeft = rect.left + scrollX + rect.width / 2 - tooltip.offsetWidth / 2;
      break;
    case 'left':
      tooltipTop = rect.top + scrollY + rect.height / 2 - tooltip.offsetHeight / 2;
      tooltipLeft = rect.left + scrollX - tooltip.offsetWidth - tooltipOffset;
      break;
    case 'right':
      tooltipTop = rect.top + scrollY + rect.height / 2 - tooltip.offsetHeight / 2;
      tooltipLeft = rect.right + scrollX + tooltipOffset;
      break;
  }

  // Ensure tooltip stays within viewport
  tooltipTop = Math.max(10, Math.min(tooltipTop, window.innerHeight - tooltip.offsetHeight - 10));
  tooltipLeft = Math.max(10, Math.min(tooltipLeft, window.innerWidth - tooltip.offsetWidth - 10));

  tooltip.style.top = `${tooltipTop}px`;
  tooltip.style.left = `${tooltipLeft}px`;

  document.body.appendChild(tooltip);

  // Store current highlight
  currentHighlight = {
    element,
    tooltip,
    overlay,
  };

  // Update position on scroll/resize
  const updatePosition = () => {
    if (!currentHighlight) return;

    const newRect = element.getBoundingClientRect();
    const newScrollX = window.scrollX || window.pageXOffset;
    const newScrollY = window.scrollY || window.pageYOffset;

    cutout.style.top = `${newRect.top + newScrollY}px`;
    cutout.style.left = `${newRect.left + newScrollX}px`;
    cutout.style.width = `${newRect.width}px`;
    cutout.style.height = `${newRect.height}px`;

    // Update tooltip position
    let newTooltipTop = 0;
    let newTooltipLeft = 0;

    switch (tooltipPosition) {
      case 'top':
        newTooltipTop = newRect.top + newScrollY - tooltip.offsetHeight - tooltipOffset;
        newTooltipLeft = newRect.left + newScrollX + newRect.width / 2 - tooltip.offsetWidth / 2;
        break;
      case 'bottom':
        newTooltipTop = newRect.bottom + newScrollY + tooltipOffset;
        newTooltipLeft = newRect.left + newScrollX + newRect.width / 2 - tooltip.offsetWidth / 2;
        break;
      case 'left':
        newTooltipTop = newRect.top + newScrollY + newRect.height / 2 - tooltip.offsetHeight / 2;
        newTooltipLeft = newRect.left + newScrollX - tooltip.offsetWidth - tooltipOffset;
        break;
      case 'right':
        newTooltipTop = newRect.top + newScrollY + newRect.height / 2 - tooltip.offsetHeight / 2;
        newTooltipLeft = newRect.right + newScrollX + tooltipOffset;
        break;
    }

    newTooltipTop = Math.max(10, Math.min(newTooltipTop, window.innerHeight - tooltip.offsetHeight - 10));
    newTooltipLeft = Math.max(10, Math.min(newTooltipLeft, window.innerWidth - tooltip.offsetWidth - 10));

    tooltip.style.top = `${newTooltipTop}px`;
    tooltip.style.left = `${newTooltipLeft}px`;
  };

  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition, { passive: true });

  // Store cleanup function
  (currentHighlight as any).cleanup = () => {
    window.removeEventListener('scroll', updatePosition);
    window.removeEventListener('resize', updatePosition);
  };

  console.log(`[ElementHighlight] Highlighted element with data-id="${dataId}"`);
  return true;
}

/**
 * Find an element by searching HTML content for specific attributes or text.
 * @param html The HTML content (from get_html tool)
 * @param searchCriteria Search criteria (data-demo-element, text, id, etc.)
 * @returns The data-id value if found, null otherwise
 */
export interface ElementSearchCriteria {
  dataDemoElement?: string;
  text?: string;
  id?: string;
  className?: string;
  tagName?: string;
}

export function findElementDataId(
  html: string,
  searchCriteria: ElementSearchCriteria
): number | null {
  try {
    // Parse HTML (simple regex-based approach for data-id extraction)
    // Look for elements matching the criteria

    // Search for data-demo-element
    if (searchCriteria.dataDemoElement) {
      const regex = new RegExp(
        `<[^>]*data-demo-element=["']${searchCriteria.dataDemoElement}["'][^>]*data-id=["'](\\d+)["']`,
        'i'
      );
      const match = html.match(regex);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    // Search for id
    if (searchCriteria.id) {
      const regex = new RegExp(
        `<[^>]*id=["']${searchCriteria.id}["'][^>]*data-id=["'](\\d+)["']`,
        'i'
      );
      const match = html.match(regex);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    // Search for text content (look for button/input with text)
    if (searchCriteria.text) {
      // Try to find button or link with the text
      const textRegex = new RegExp(
        `(<(?:button|a)[^>]*>.*?${searchCriteria.text}.*?</(?:button|a)>).*?data-id=["'](\\d+)["']`,
        'is'
      );
      const match = html.match(textRegex);
      if (match && match[2]) {
        return parseInt(match[2], 10);
      }

      // Alternative: find element containing text, then look backwards for data-id
      const textIndex = html.toLowerCase().indexOf(searchCriteria.text.toLowerCase());
      if (textIndex !== -1) {
        // Look backwards from text for nearest data-id
        const beforeText = html.substring(Math.max(0, textIndex - 500), textIndex);
        const dataIdMatch = beforeText.match(/data-id=["'](\d+)["']/);
        if (dataIdMatch && dataIdMatch[1]) {
          return parseInt(dataIdMatch[1], 10);
        }
      }
    }

    // Search for className
    if (searchCriteria.className) {
      const regex = new RegExp(
        `<[^>]*class=["'][^"']*${searchCriteria.className}[^"']*["'][^>]*data-id=["'](\\d+)["']`,
        'i'
      );
      const match = html.match(regex);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  } catch (error) {
    console.error('[ElementHighlight] Error finding element:', error);
    return null;
  }
}

/**
 * Clear the current highlight and tooltip.
 */
export function clearHighlight(): void {
  if (currentHighlight) {
    // Remove highlight class
    currentHighlight.element.classList.remove('element-highlight');
    currentHighlight.element.style.cssText = currentHighlight.element.style.cssText.replace(
      /background-color:.*? !important;|border:.*? !important;|box-shadow:.*? !important;/g,
      ''
    );

    // Remove tooltip and overlay
    if (currentHighlight.tooltip && currentHighlight.tooltip.parentNode) {
      currentHighlight.tooltip.parentNode.removeChild(currentHighlight.tooltip);
    }
    if (currentHighlight.overlay && currentHighlight.overlay.parentNode) {
      currentHighlight.overlay.parentNode.removeChild(currentHighlight.overlay);
    }

    // Cleanup event listeners
    if ((currentHighlight as any).cleanup) {
      (currentHighlight as any).cleanup();
    }

    currentHighlight = null;
    console.log('[ElementHighlight] Highlight cleared');
  }

  // Also remove any orphaned elements
  const orphanedOverlay = document.getElementById('element-highlight-overlay');
  const orphanedTooltip = document.getElementById('element-highlight-tooltip');
  if (orphanedOverlay) orphanedOverlay.remove();
  if (orphanedTooltip) orphanedTooltip.remove();
}

/**
 * Process a "show" mode question to find and highlight an element.
 * This is called when user asks questions like "Show me how to login".
 * 
 * @param question The user's question
 * @param html The HTML content from get_html tool
 * @param actionType The action type (e.g., "click_element", "type_text")
 * @returns true if element was found and highlighted, false otherwise
 */
export function processShowModeQuestion(
  question: string,
  html: string,
  actionType?: string
): boolean {
  // Normalize question to lowercase for matching
  const normalizedQuestion = question.toLowerCase();

  // Determine what element to find based on question
  let searchCriteria: ElementSearchCriteria = {};

  // Check for login-related keywords
  if (normalizedQuestion.includes('login') || normalizedQuestion.includes('sign in')) {
    // Try multiple strategies
    searchCriteria = {
      dataDemoElement: 'login-button',
      text: 'login',
      id: 'login-button',
    };
  } else if (normalizedQuestion.includes('sign up') || normalizedQuestion.includes('register')) {
    searchCriteria = {
      dataDemoElement: 'signup-button',
      text: 'sign up',
    };
  } else if (normalizedQuestion.includes('submit')) {
    searchCriteria = {
      text: 'submit',
      tagName: 'button',
    };
  }

  // Try to find element
  let dataId: number | null = null;

  // Try data-demo-element first
  if (searchCriteria.dataDemoElement) {
    dataId = findElementDataId(html, { dataDemoElement: searchCriteria.dataDemoElement });
  }

  // Try text search if not found
  if (dataId === null && searchCriteria.text) {
    dataId = findElementDataId(html, { text: searchCriteria.text });
  }

  // Try id if not found
  if (dataId === null && searchCriteria.id) {
    dataId = findElementDataId(html, { id: searchCriteria.id });
  }

  if (dataId === null) {
    console.warn('[ElementHighlight] Could not find element for question:', question);
    return false;
  }

  // Determine tooltip text based on action type
  let tooltipText = 'Click this element';
  if (actionType === 'click_element') {
    tooltipText = 'Click this button';
  } else if (actionType === 'type_text') {
    tooltipText = 'Type in this field';
  }

  // Highlight the element
  return highlightElementByDataId(dataId, {
    tooltipText,
    tooltipPosition: 'top',
  });
}

