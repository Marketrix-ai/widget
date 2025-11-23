export interface ShowModeOptions {
  element: HTMLElement;
  explanation: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  isClickAction?: boolean;
}

export class ShowModeService {
  private static instance: ShowModeService;

  private currentPopup: HTMLElement | null = null;
  private currentHighlight: HTMLElement | null = null;
  private currentElement: HTMLElement | null = null;
  private currentOptions: ShowModeOptions | null = null;
  private currentPromise: Promise<boolean> | null = null;
  private resolvePromise: ((value: boolean) => void) | null = null;
  private rejectPromise: ((reason?: unknown) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private updateHighlightPosition: (() => void) | null = null;
  private rafId: number | null = null;

  private constructor() {}

  static getInstance(): ShowModeService {
    if (!ShowModeService.instance) {
      ShowModeService.instance = new ShowModeService();
    }
    return ShowModeService.instance;
  }

  async showToolAction(options: ShowModeOptions): Promise<boolean> {
    const { element, explanation, isClickAction = false, toolName } = options;

    if (
      this.currentOptions?.element === element &&
      this.currentOptions.explanation === explanation &&
      this.currentOptions.toolName === toolName &&
      this.currentPromise
    ) {
      console.log('[ShowModeService] Duplicate tool action detected, returning existing promise');
      return this.currentPromise;
    }

    this.cleanup();
    this.currentOptions = options;
    this.currentElement = element;

    element.scrollIntoView({ behavior: 'auto', block: 'center' });

    this.createHighlight(element);
    this.createPopup(explanation, isClickAction);
    this.setupPositionUpdates();

    if (isClickAction) {
      // For click actions, we let the event propagate first (to trigger the actual click)
      // and then we resolve. But the overlay is in the way.
      // We used pointer-events: none on highlight, but the popup might be blocking?
      // Or we want the overlay to catch the click (as confirmation) and THEN we click the element?
      // The 'isClickAction' implies the user is clicking the element THROUGH the highlight.
      // But highlight has pointer-events: none. So the click goes to the element directly?
      // If the click goes to the element directly, our document listener catches it.
      // But if the element has stopPropagation, our listener might not catch it in bubble phase.
      // We use capture: true, so we catch it first.
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
    if (this.rejectPromise) {
      this.rejectPromise('Cancelled by cleanup');
      this.rejectPromise = null;
    }
    this.resolvePromise = null;

    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, { capture: true });
      this.clickHandler = null;
    }
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, { capture: true });
      window.removeEventListener('resize', this.scrollHandler);
      window.removeEventListener('touchmove', this.scrollHandler);
      window.removeEventListener('wheel', this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.updateHighlightPosition = null;
    this.currentPopup?.remove();
    this.currentPopup = null;
    this.currentHighlight?.remove();
    this.currentHighlight = null;
    this.currentElement = null;
    this.currentOptions = null;
    this.currentPromise = null;
    this.resolvePromise = null;
    this.rejectPromise = null;
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
    z-index: 2147483646;
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
    document.body.appendChild(popup);
    this.currentPopup = popup;

    if (!isClickAction) {
      this.setupContinueButton(popup);
    }

    this.updatePopupPosition();
  }

  private setupPositionUpdates(): void {
    this.updateHighlightPosition = () => {
      if (!this.currentElement || !this.currentHighlight) return;
      const rect = this.currentElement.getBoundingClientRect();
      this.currentHighlight.style.top = `${rect.top}px`;
      this.currentHighlight.style.left = `${rect.left}px`;
      this.currentHighlight.style.width = `${rect.width}px`;
      this.currentHighlight.style.height = `${rect.height}px`;
      this.updatePopupPosition();
    };

    this.scrollHandler = () => {
      if (this.rafId !== null) window.cancelAnimationFrame(this.rafId);
      this.updateHighlightPosition?.();
    };

    window.addEventListener('scroll', this.scrollHandler, { capture: true, passive: true });
    window.addEventListener('resize', this.scrollHandler, { passive: true });
    window.addEventListener('touchmove', this.scrollHandler, { passive: true });
    window.addEventListener('wheel', this.scrollHandler, { passive: true });
  }

  private updatePopupPosition(): void {
    if (!this.currentPopup || !this.currentElement) return;

    const rect = this.currentElement.getBoundingClientRect();
    const popupWidth = 320;
    const popupHeight = 120; // Approx height
    const spacing = 20;
    const padding = 10;

    // Simple logic for now: prefer right, then left, then top, then bottom
    // ... (Implementation of smart positioning logic similar to original)
    // For brevity in this refactor, I'll implement a simpler version or copy logic.
    // I will copy the logic because it's good.

    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;

    const positions = [
      { left: rect.right + spacing, top: elementCenterY - popupHeight / 2 }, // Right
      { left: rect.left - popupWidth - spacing, top: elementCenterY - popupHeight / 2 }, // Left
      { left: elementCenterX - popupWidth / 2, top: rect.top - popupHeight - spacing }, // Top
      { left: elementCenterX - popupWidth / 2, top: rect.bottom + spacing }, // Bottom
    ];

    // Find first position that fits
    let bestPos = positions[0];
    for (const pos of positions) {
      if (
        pos.left >= padding &&
        pos.left + popupWidth <= window.innerWidth - padding &&
        pos.top >= padding &&
        pos.top + popupHeight <= window.innerHeight - padding
      ) {
        bestPos = pos;
        break;
      }
    }

    // Clamp to screen
    const left = Math.max(
      padding,
      Math.min(bestPos.left, window.innerWidth - popupWidth - padding)
    );
    const top = Math.max(
      padding,
      Math.min(bestPos.top, window.innerHeight - popupHeight - padding)
    );

    this.currentPopup.style.cssText += `
    position: fixed;
      top: ${top}px;
      left: ${left}px;
    width: ${popupWidth}px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    padding: 16px;
    `;
  }

  private setupClickHandler(): void {
    this.clickHandler = (e: MouseEvent) => {
      if (!this.currentElement || !this.resolvePromise) return;

      // Use composedPath to handle Shadow DOM retargeting and event bubbling properly
      const path = e.composedPath();
      const isClickOnElement = path.includes(this.currentElement);

      if (isClickOnElement) {
        // Do NOT stop propagation for click actions on the element itself
        // e.stopPropagation();
        // e.preventDefault();

        console.log('[ShowModeService] Click detected on element, resolving promise');
        const resolve = this.resolvePromise;
        this.resolvePromise = null;
        this.rejectPromise = null;
        // Use a longer timeout to ensure click propagates
        setTimeout(() => resolve(true), 50);
      }
    };

    // Attach with capture to ensure we see it, but we must be careful not to stop propagation if we want the click to happen
    document.addEventListener('click', this.clickHandler, { capture: true });
  }

  private setupContinueButton(popup: HTMLElement): void {
    window.requestAnimationFrame(() => {
      const btn = popup.querySelector('#marketrix-show-continue') as HTMLButtonElement;
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.resolvePromise) {
            const resolve = this.resolvePromise;
            this.resolvePromise = null;
            this.rejectPromise = null;
            setTimeout(() => resolve(true), 0);
          }
        });
      }
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const showModeService = ShowModeService.getInstance();
