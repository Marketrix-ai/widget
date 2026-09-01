import { domService } from './DomService';

export interface ShowModeOptions {
  element: HTMLElement;
  explanation: string;
  browserToolName: string;
  isClickAction?: boolean;
}

// scroll is capture-phase so the highlight tracks a scrolling container, not just the window.
const REPOSITION_EVENTS = ['scroll', 'resize', 'touchmove', 'wheel'] as const;

const POPUP_WIDTH_PX = 320;
// Painted once at create time — reposition only writes top/left, so scrolling cannot grow the style attribute.
const POPUP_CHROME_CSS = `position: fixed; width: ${POPUP_WIDTH_PX}px; background: white; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 2147483646; padding: 16px;`;

export class ShowModeService {
  private currentPopup: HTMLElement | null = null;
  private currentHighlight: HTMLElement | null = null;
  private currentElement: HTMLElement | null = null;
  private currentOptions: ShowModeOptions | null = null;
  private currentPromise: Promise<boolean> | null = null;
  private resolvePromise: ((value: boolean) => void) | null = null;
  private rejectPromise: ((reason?: unknown) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private visibilityCheckInterval: ReturnType<typeof setInterval> | null = null;

  async showToolAction(options: ShowModeOptions): Promise<boolean> {
    const { element, explanation, isClickAction = false, browserToolName } = options;

    if (
      this.currentOptions?.element === element &&
      this.currentOptions.explanation === explanation &&
      this.currentOptions.browserToolName === browserToolName &&
      this.currentPromise
    ) {
      console.log('[ShowModeService] Duplicate tool action detected, returning existing promise');
      return this.currentPromise;
    }

    this.cleanup();
    this.currentOptions = options;
    this.currentElement = element;

    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    this.createHighlight(element);
    this.createPopup(explanation, isClickAction);
    this.setupPositionUpdates();
    this.setupVisibilityMonitoring();

    if (isClickAction) {
      // Highlight uses pointer-events:none so the click reaches the element; we capture it on document first.
      this.setupClickHandler();
    }

    this.currentPromise = new Promise<boolean>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    }).finally(() => {
      this.cleanup();
    });

    return this.currentPromise;
  }

  cleanup(): void {
    this.takeSettlers().reject?.('Cancelled by cleanup');

    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, { capture: true });
      this.clickHandler = null;
    }
    if (this.scrollHandler) {
      for (const event of REPOSITION_EVENTS) {
        window.removeEventListener(event, this.scrollHandler, { capture: true });
      }
      this.scrollHandler = null;
    }

    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
      this.visibilityCheckInterval = null;
    }

    this.currentPopup?.remove();
    this.currentHighlight?.remove();
    // A node whose cleanup was interrupted outlives its handle.
    document.getElementById('marketrix-show-popup')?.remove();
    document.getElementById('marketrix-show-highlight')?.remove();

    this.currentPopup = null;
    this.currentHighlight = null;
    this.currentElement = null;
    this.currentOptions = null;
    this.currentPromise = null;
  }

  /** Detach both settlers before calling one — the click handler, the Continue button and the two watchdogs race. */
  private takeSettlers(): { resolve: ((value: boolean) => void) | null; reject: ((reason?: unknown) => void) | null } {
    const settlers = { resolve: this.resolvePromise, reject: this.rejectPromise };
    this.resolvePromise = null;
    this.rejectPromise = null;
    return settlers;
  }

  private createHighlight(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
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
    z-index: 2147483645;
    pointer-events: none;
    transition: none;
  `;
    document.body.appendChild(highlight);
    this.currentHighlight = highlight;
  }

  private createPopup(explanation: string, isClickAction: boolean): void {
    const popup = document.createElement('div');
    popup.id = 'marketrix-show-popup';

    const content = isClickAction
      ? `<div style="font-weight: 500; color: #1f2937; font-size: 12px;">${this.escapeHtml(explanation)}</div>`
      : `<div style="margin-bottom: 12px; font-weight: 500; color: #1f2937; font-size: 12px;">${this.escapeHtml(explanation)}</div>
         <div style="display: flex; gap: 8px; justify-content: flex-end;">
           <button id="marketrix-show-continue" style="
             background: #3b82f6; color: white; border: none; border-radius: 6px;
             padding: 8px 16px; font-size: 12px; font-weight: 500; cursor: pointer;
           ">Continue</button>
         </div>`;

    popup.innerHTML = content;
    popup.style.cssText = POPUP_CHROME_CSS;
    document.body.appendChild(popup);
    this.currentPopup = popup;

    if (!isClickAction) {
      this.setupContinueButton(popup);
    }

    this.updatePopupPosition();
  }

  private setupPositionUpdates(): void {
    this.scrollHandler = () => {
      if (!this.currentElement || !this.currentHighlight) return;
      const rect = this.currentElement.getBoundingClientRect();
      Object.assign(this.currentHighlight.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      this.updatePopupPosition();
    };

    for (const event of REPOSITION_EVENTS) {
      window.addEventListener(event, this.scrollHandler, { capture: true, passive: true });
    }
  }

  private updatePopupPosition(): void {
    if (!this.currentPopup || !this.currentElement) return;

    const rect = this.currentElement.getBoundingClientRect();
    const popupHeight = 120; // Approx height
    const spacing = 20;
    const padding = 10;

    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;

    // Right, left, above, below — first that fits the viewport wins.
    const positions = [
      { left: rect.right + spacing, top: elementCenterY - popupHeight / 2 },
      { left: rect.left - POPUP_WIDTH_PX - spacing, top: elementCenterY - popupHeight / 2 },
      { left: elementCenterX - POPUP_WIDTH_PX / 2, top: rect.top - popupHeight - spacing },
      { left: elementCenterX - POPUP_WIDTH_PX / 2, top: rect.bottom + spacing },
    ];

    let bestPos = positions[0];
    for (const pos of positions) {
      if (
        pos.left >= padding &&
        pos.left + POPUP_WIDTH_PX <= window.innerWidth - padding &&
        pos.top >= padding &&
        pos.top + popupHeight <= window.innerHeight - padding
      ) {
        bestPos = pos;
        break;
      }
    }

    this.currentPopup.style.left = `${Math.max(padding, Math.min(bestPos.left, window.innerWidth - POPUP_WIDTH_PX - padding))}px`;
    this.currentPopup.style.top = `${Math.max(padding, Math.min(bestPos.top, window.innerHeight - popupHeight - padding))}px`;
  }

  private setupClickHandler(): void {
    this.clickHandler = (e: MouseEvent) => {
      if (!this.currentElement || !this.resolvePromise) return;

      // composedPath sees through Shadow DOM retargeting and bubbling.
      const path = e.composedPath();
      const isClickOnElement = path.includes(this.currentElement);

      if (isClickOnElement) {
        // Intercept so navigation/action doesn't fire before we process the tool result.
        e.preventDefault();
        e.stopPropagation();

        this.takeSettlers().resolve?.(true);
      }
    };

    document.addEventListener('click', this.clickHandler, { capture: true });
  }

  private setupContinueButton(popup: HTMLElement): void {
    window.requestAnimationFrame(() => {
      popup.querySelector('#marketrix-show-continue')?.addEventListener('click', e => {
        e.stopPropagation();
        this.takeSettlers().resolve?.(true);
      });
    });
  }

  /** checkElementInteractable's first test is `document.body.contains`, so this one watchdog also covers removal. */
  private setupVisibilityMonitoring(): void {
    this.visibilityCheckInterval = setInterval(() => {
      if (!this.currentElement) return;
      const index = domService.getSequenceForElement(this.currentElement) ?? -1;
      const error = domService.checkElementInteractable(this.currentElement, index);
      if (error) this.failWithElementGone(error);
    }, 200);
  }

  private failWithElementGone(reason: string): void {
    this.takeSettlers().reject?.(new Error(`ELEMENT_GONE: ${reason}`));
    this.cleanup();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const showModeService = new ShowModeService();
