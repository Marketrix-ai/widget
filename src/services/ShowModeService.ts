/**
 * Show mode's on-page coaching overlay: it highlights one host-page element, explains the step beside it, and
 * returns a promise that settles when the visitor acts — so `BrowserToolService` can await a `show`-mode tool
 * call before running the tool. `showModeService` is the singleton every caller uses (`BrowserToolService` to
 * stage an action, `ChatView` to tear one down).
 *
 * Contents. `ShowModeOptions` — the element, its explanation, the browser tool name, and whether the visitor
 * completes the step by clicking the element itself rather than a Continue button. `showToolAction` scrolls the
 * element to centre, mounts highlight and popup, arms the handlers and hands back the pending promise; a restage
 * with identical element, explanation and tool returns the in-flight promise instead of rebuilding the overlay
 * (a duplicate tool call). `cleanup` cancels an in-flight action and unwinds listeners, watchdog and nodes.
 * `settle` resolves, or rejects with `failure`, then cleans up. `takeSettlers` detaches both settlers and hands
 * them back. `createHighlight` and `createPopup` build the two overlay nodes. `setupPositionUpdates` repins them
 * to a moving element; `updatePopupPosition` chooses the popup's spot. `setupClickHandler` watches for the click
 * on the element itself. `setupVisibilityMonitoring` is the 200ms watchdog that fails the action once the element
 * stops being usable. `escapeHtml` renders the explanation as text.
 *
 * Why it is shaped this way:
 * - Exactly one settle. The element click, the Continue button and both watchdog branches race, so `takeSettlers`
 *   detaches resolve AND reject before either is called; the off-screen branch also returns instead of falling
 *   through, so a rejection carries the one reason that actually fired and never a second contradicting code.
 * - The highlight is `pointer-events:none` so the visitor's click reaches the real element; the handler sits on
 *   `document` in the capture phase, tests `composedPath` (which sees through Shadow DOM retargeting and
 *   bubbling), and preventDefault/stopPropagation so navigation cannot fire before the tool result is processed.
 * - `#marketrix-show-highlight` and `#marketrix-show-popup` are load-bearing ids: `DomService.notInteractableReason`
 *   allowlists them in its occlusion test, so our own overlay never reads as an element-obscuring modal, and
 *   `cleanup` re-finds them by id because a node whose cleanup was interrupted outlives its handle.
 * - Reposition listens in the capture phase so the highlight tracks a scrolling CONTAINER, not just the window.
 * - Popup chrome is painted once at create time and reposition writes only top/left, so scrolling cannot grow the
 *   style attribute. The highlight's cssText is built on one line because template-literal whitespace is not
 *   minified — indentation there would ship to every host page.
 * - Placement tries right, left, above, below and takes the first that fits the viewport, then clamps into it;
 *   the 120px popup height is an assumption, not a measurement.
 * - `notInteractableReason`'s first test is `document.body.contains`, so that one watchdog also covers removal.
 */

import { domService } from './DomService';

export interface ShowModeOptions {
  element: HTMLElement;
  explanation: string;
  browserToolName: string;
  isClickAction?: boolean;
}

const REPOSITION_EVENTS = ['scroll', 'resize', 'touchmove', 'wheel'] as const;

const POPUP_WIDTH_PX = 320;
const POPUP_CHROME_CSS = `position: fixed; width: ${POPUP_WIDTH_PX}px; background: white; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 2147483646; padding: 16px;`;

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
      console.log('[ShowModeService] Duplicate tool action detected, returning existing promise');
      return this.currentPromise;
    }

    this.cleanup();
    this.currentOptions = options;
    this.currentElement = element;

    element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });

    this.createHighlight(element);
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

  private createHighlight(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.id = 'marketrix-show-highlight';
    highlight.style.cssText =
      `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;` +
      'border:3px solid #3b82f6;border-radius:4px;' +
      'box-shadow:0 0 0 4px rgba(59,130,246,0.2),0 0 20px rgba(59,130,246,0.4);' +
      'z-index:2147483645;pointer-events:none;transition:none;';
    document.body.appendChild(highlight);
    this.currentHighlight = highlight;
  }

  private createPopup(explanation: string, isClickAction: boolean): void {
    const popup = document.createElement('div');
    popup.id = 'marketrix-show-popup';

    const content = isClickAction
      ? `<div style="font-weight: 500; color: #1f2937; font-size: 12px;">${this.escapeHtml(explanation)}</div>`
      : `<div style="margin-bottom:12px;font-weight:500;color:#1f2937;font-size:12px;">${this.escapeHtml(explanation)}</div>` +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button id="marketrix-show-continue" style="background:#3b82f6;color:white;border:none;' +
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
    const popupHeight = 120;
    const spacing = 20;
    const padding = 10;

    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;

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
