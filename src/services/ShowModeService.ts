/**
 * Show mode's on-page coaching overlay: highlights one host-page element, explains the step beside it,
 * and waits for the visitor to act before the tool actually runs.
 *
 * `showToolAction` mounts the highlight and popup and returns a promise that settles on a click, the
 * Continue button, or a timeout if the element goes off-screen or disappears. `cleanup` removes them.
 * `showModeService` is the singleton `BrowserToolService` awaits before running a `show`-mode tool call.
 *
 * The overlay mounts onto the host page itself, outside the widget's shadow root, so it uses its own
 * plain colours rather than the widget's themed design tokens.
 */

import { LAYER_TOKENS } from '../design-system/component-tokens';
import { domService } from './DomService';

interface ShowModeOptions {
  element: HTMLElement;
  explanation: string;
  browserToolName: string;
  isClickAction?: boolean;
}

interface Position {
  left: number;
  top: number;
}

const REPOSITION_EVENTS = ['scroll', 'resize', 'touchmove', 'wheel'] as const;

const POPUP_WIDTH_PX = 320;
const ACCENT_COLOR = '#3b82f6';
const TEXT_COLOR = '#1f2937';
const POPUP_CHROME_CSS = `position: fixed; width: ${POPUP_WIDTH_PX}px; background: white; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: ${LAYER_TOKENS.showPopup}; padding: 16px;`;

export class ShowModeService {
  private currentPopup: HTMLElement | null = null;
  private currentHighlight: HTMLElement | null = null;
  private currentElement: HTMLElement | null = null;
  private currentOptions: ShowModeOptions | null = null;
  private currentPromise: Promise<void> | null = null;
  private resolvePromise: (() => void) | null = null;
  private rejectPromise: ((reason?: unknown) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private visibilityCheckInterval: ReturnType<typeof setInterval> | null = null;

  async showToolAction(options: ShowModeOptions): Promise<void> {
    const { element, explanation, isClickAction = false, browserToolName } = options;

    if (
      this.currentOptions?.element === element &&
      this.currentOptions.explanation === explanation &&
      this.currentOptions.browserToolName === browserToolName &&
      this.currentPromise
    ) {
      return this.currentPromise;
    }

    this.cleanup();
    this.currentOptions = options;
    this.currentElement = element;

    element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });

    this.createHighlight();
    this.createPopup(explanation, isClickAction);
    this.setupPositionUpdates();
    this.setupVisibilityMonitoring();

    if (isClickAction) {
      this.setupClickHandler();
    }

    this.currentPromise = new Promise<void>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    return this.currentPromise;
  }

  cleanup(): void {
    this.takeSettlers().reject?.(new Error('Cancelled by cleanup'));

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
    document.getElementById('marketrix-show-popup')?.remove();
    document.getElementById('marketrix-show-highlight')?.remove();

    this.currentPopup = null;
    this.currentHighlight = null;
    this.currentElement = null;
    this.currentOptions = null;
    this.currentPromise = null;
  }

  private settle(failure?: string): void {
    const { resolve, reject } = this.takeSettlers();
    if (failure) reject?.(new Error(failure));
    else resolve?.();
    this.cleanup();
  }

  private takeSettlers(): { resolve: (() => void) | null; reject: ((reason?: unknown) => void) | null } {
    const settlers = { resolve: this.resolvePromise, reject: this.rejectPromise };
    this.resolvePromise = null;
    this.rejectPromise = null;
    return settlers;
  }

  private createHighlight(): void {
    const highlight = document.createElement('div');
    highlight.id = 'marketrix-show-highlight';
    highlight.style.cssText =
      `position:fixed;border:3px solid ${ACCENT_COLOR};border-radius:4px;` +
      `box-shadow:0 0 0 4px rgba(59,130,246,0.2),0 0 20px rgba(59,130,246,0.4);` +
      `z-index:${LAYER_TOKENS.showHighlight};pointer-events:none;transition:none;`;
    document.body.appendChild(highlight);
    this.currentHighlight = highlight;
    this.trackElement();
  }

  private trackElement(): void {
    if (!this.currentElement || !this.currentHighlight) return;
    const rect = this.currentElement.getBoundingClientRect();
    Object.assign(this.currentHighlight.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    this.updatePopupPosition();
  }

  private createPopup(explanation: string, isClickAction: boolean): void {
    const popup = document.createElement('div');
    popup.id = 'marketrix-show-popup';

    const content = isClickAction
      ? `<div style="font-weight: 500; color: ${TEXT_COLOR}; font-size: 12px;">${this.escapeHtml(explanation)}</div>`
      : `<div style="margin-bottom:12px;font-weight:500;color:${TEXT_COLOR};font-size:12px;">${this.escapeHtml(explanation)}</div>` +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        `<button id="marketrix-show-continue" style="background:${ACCENT_COLOR};color:white;border:none;` +
        'border-radius:6px;padding:8px 16px;font-size:12px;font-weight:500;cursor:pointer;">Continue</button></div>';

    popup.innerHTML = content;
    popup.style.cssText = POPUP_CHROME_CSS;
    document.body.appendChild(popup);
    this.currentPopup = popup;

    if (!isClickAction) {
      window.requestAnimationFrame(() => {
        popup.querySelector('#marketrix-show-continue')?.addEventListener('click', e => {
          e.stopPropagation();
          this.settle();
        });
      });
    }

    this.updatePopupPosition();
  }

  private setupPositionUpdates(): void {
    this.scrollHandler = () => this.trackElement();

    for (const event of REPOSITION_EVENTS) {
      window.addEventListener(event, this.scrollHandler, { capture: true, passive: true });
    }
  }

  private updatePopupPosition(): void {
    if (!this.currentPopup || !this.currentElement) return;

    const rect = this.currentElement.getBoundingClientRect();
    const popupHeight = 120;
    const spacing = 20;
    const padding = 10;

    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;

    const positions: [Position, Position, Position, Position] = [
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

      const path = e.composedPath();
      const isClickOnElement = path.includes(this.currentElement);

      if (isClickOnElement) {
        e.preventDefault();
        e.stopPropagation();

        this.settle();
      }
    };

    document.addEventListener('click', this.clickHandler, { capture: true });
  }

  private setupVisibilityMonitoring(): void {
    this.visibilityCheckInterval = setInterval(() => {
      const element = this.currentElement;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        this.settle('ELEMENT_OFF_SCREEN: The highlighted element scrolled out of view');
        return;
      }
      const index = domService.getSequenceForElement(element) ?? -1;
      const reason = domService.notInteractableReason(element, index);
      if (reason) this.settle(reason);
    }, 200);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const showModeService = new ShowModeService();
