// Utility functions for highlighting elements and creating spotlight effects

export interface HighlightOptions {
  element: HTMLElement;
  duration?: number;
  spotlightColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  zIndex?: number;
}

export class ElementHighlighter {
  private static instance: ElementHighlighter;
  private currentHighlight: HTMLElement | null = null;
  private spotlightOverlay: HTMLElement | null = null;

  static getInstance(): ElementHighlighter {
    if (!ElementHighlighter.instance) {
      ElementHighlighter.instance = new ElementHighlighter();
    }
    return ElementHighlighter.instance;
  }

  /**
   * Highlight an element with spotlight effect
   */
  highlightElement(options: HighlightOptions): void {
    const {
      element,
      duration = 3000,
      spotlightColor = 'rgba(255, 255, 0, 0.3)',
      borderColor = '#ffd700',
      borderWidth = 3,
      borderRadius = 8,
      zIndex = 9999,
    } = options;

    // Clear any existing highlight
    this.clearHighlight();

    // Store reference to current element
    this.currentHighlight = element;

    // Get element position and dimensions
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Create spotlight overlay
    this.createSpotlightOverlay({
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
      spotlightColor,
      borderColor,
      borderWidth,
      borderRadius,
      zIndex,
    });

    // Add highlight class to element
    element.classList.add('marketrix-highlighted');
    element.style.position = 'relative';
    element.style.zIndex = (zIndex + 1).toString();

    // Scroll element into view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });

    // Auto-clear highlight after duration
    setTimeout(() => {
      this.clearHighlight();
    }, duration);
  }

  /**
   * Create spotlight overlay effect
   */
  private createSpotlightOverlay(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    spotlightColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    zIndex: number;
  }): void {
    const { x, y, width, height, spotlightColor, borderColor, borderWidth, borderRadius, zIndex } =
      options;

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'marketrix-spotlight-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = zIndex.toString();
    overlay.style.pointerEvents = 'none';

    // Create spotlight effect using CSS mask
    overlay.style.background = `radial-gradient(ellipse at center, transparent 0%, transparent 40%, ${spotlightColor} 100%)`;
    overlay.style.mask = `
      radial-gradient(
        ellipse ${width + 40}px ${height + 40}px at ${x + width / 2}px ${y + height / 2}px,
        transparent 0%,
        transparent 40%,
        black 100%
      )
    `;
    overlay.style.webkitMask = overlay.style.mask;

    // Create border highlight
    const border = document.createElement('div');
    border.style.position = 'absolute';
    border.style.left = `${x - borderWidth}px`;
    border.style.top = `${y - borderWidth}px`;
    border.style.width = `${width + borderWidth * 2}px`;
    border.style.height = `${height + borderWidth * 2}px`;
    border.style.border = `${borderWidth}px solid ${borderColor}`;
    border.style.borderRadius = `${borderRadius}px`;
    border.style.boxShadow = `0 0 20px ${borderColor}`;
    border.style.animation = 'marketrix-pulse 2s infinite';

    // Add pulse animation
    this.addPulseAnimation();

    overlay.appendChild(border);
    document.body.appendChild(overlay);
    this.spotlightOverlay = overlay;
  }

  /**
   * Add pulse animation CSS
   */
  private addPulseAnimation(): void {
    if (document.getElementById('marketrix-pulse-animation')) return;

    const style = document.createElement('style');
    style.id = 'marketrix-pulse-animation';
    style.textContent = `
      @keyframes marketrix-pulse {
        0%, 100% { 
          opacity: 1; 
          transform: scale(1);
        }
        50% { 
          opacity: 0.7; 
          transform: scale(1.05);
        }
      }
      
      .marketrix-highlighted {
        animation: marketrix-pulse 2s infinite;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Clear current highlight
   */
  clearHighlight(): void {
    // Remove highlight class from element
    if (this.currentHighlight) {
      this.currentHighlight.classList.remove('marketrix-highlighted');
      this.currentHighlight.style.position = '';
      this.currentHighlight.style.zIndex = '';
      this.currentHighlight = null;
    }

    // Remove spotlight overlay
    if (this.spotlightOverlay) {
      document.body.removeChild(this.spotlightOverlay);
      this.spotlightOverlay = null;
    }
  }

  /**
   * Find and highlight element by selector
   */
  highlightBySelector(selector: string, options?: Partial<HighlightOptions>): boolean {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      this.highlightElement({
        element,
        ...options,
      });
      return true;
    }
    return false;
  }

  /**
   * Find and highlight element by text content
   */
  highlightByText(text: string, options?: Partial<HighlightOptions>): boolean {
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div');
    for (const element of elements) {
      if (element.textContent?.includes(text)) {
        this.highlightElement({
          element: element as HTMLElement,
          ...options,
        });
        return true;
      }
    }
    return false;
  }
}

// Export singleton instance
export const elementHighlighter = ElementHighlighter.getInstance();
