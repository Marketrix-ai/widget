/**
 * Show mode's on-page coaching overlay: highlights one host-page element, explains the step beside it,
 * and waits for the visitor to act before the tool runs.
 * `showToolAction` mounts the overlay and settles on a click or Continue, failing once the element leaves view;
 * `cleanup` removes it and rejects a pending step with `ShowModeCancelled`; `showModeService` groups the two for
 * `browserTools`. The overlay mounts outside the widget's shadow root, so it uses plain colours,
 * not theme tokens.
 */

import { LAYER_TOKENS } from '../design-system/component-tokens';
import type { WidgetToolName } from './browserTools';
import { domService } from './DomService';

interface ShowModeOptions {
  element: HTMLElement;
  index: number;
  explanation: string;
  browserToolName: WidgetToolName;
}

interface Position {
  left: number;
  top: number;
}

export class ShowModeCancelled extends Error {}

const REPOSITION_EVENTS = ['scroll', 'resize', 'touchmove', 'wheel'] as const;

const POPUP_WIDTH_PX = 320;
const ACCENT_COLOR = '#3b82f6';
const TEXT_COLOR = '#1f2937';
const POPUP_CHROME_CSS = `position: fixed; width: ${POPUP_WIDTH_PX}px; background: white; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: ${LAYER_TOKENS.showPopup}; padding: 16px;`;

interface ActiveStep {
  options: ShowModeOptions;
  popup: HTMLElement;
  highlight: HTMLElement;
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: Error) => void;
  clickHandler: ((e: MouseEvent) => void) | null;
  repositionHandler: () => void;
  visibilityCheck: ReturnType<typeof setInterval>;
}

let active: ActiveStep | null = null;

function showToolAction(options: ShowModeOptions): Promise<void> {
  const { element, explanation, browserToolName } = options;
  const isClickAction = browserToolName === 'click_element';

  if (
    active?.options.element === element &&
    active.options.explanation === explanation &&
    active.options.browserToolName === browserToolName
  ) {
    return active.promise;
  }

  cleanup();

  element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });

  const highlight = document.createElement('div');
  highlight.id = 'marketrix-show-highlight';
  highlight.style.cssText =
    `position:fixed;border:3px solid ${ACCENT_COLOR};border-radius:4px;` +
    `box-shadow:0 0 0 4px rgba(59,130,246,0.2),0 0 20px rgba(59,130,246,0.4);` +
    `z-index:${LAYER_TOKENS.showHighlight};pointer-events:none;transition:none;`;

  const popup = document.createElement('div');
  popup.id = 'marketrix-show-popup';
  popup.style.cssText = POPUP_CHROME_CSS;
  const text = document.createElement('div');
  text.setAttribute('role', 'status');
  text.style.cssText = `font-weight:500;color:${TEXT_COLOR};font-size:12px;${isClickAction ? '' : 'margin-bottom:12px;'}`;
  popup.append(text);

  let clickHandler: ActiveStep['clickHandler'] = null;
  if (isClickAction) {
    clickHandler = (e: MouseEvent) => {
      if (!e.composedPath().includes(element)) return;
      e.preventDefault();
      e.stopPropagation();
      settle();
    };
    document.addEventListener('click', clickHandler, { capture: true });
  } else {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    const button = document.createElement('button');
    button.id = 'marketrix-show-continue';
    button.textContent = 'Continue';
    button.style.cssText =
      `background:${ACCENT_COLOR};color:white;border:none;border-radius:6px;padding:8px 16px;` +
      'font-size:12px;font-weight:500;cursor:pointer;';
    button.addEventListener('click', e => {
      e.stopPropagation();
      settle();
    });
    row.append(button);
    popup.append(row);
  }

  document.body.append(highlight, popup);
  requestAnimationFrame(() => {
    if (active?.popup === popup) text.textContent = explanation;
  });

  const repositionHandler = () => trackElement(element, highlight, popup);
  for (const event of REPOSITION_EVENTS) {
    window.addEventListener(event, repositionHandler, { capture: true, passive: true });
  }

  const visibilityCheck = setInterval(() => {
    const rect = element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      settle('ELEMENT_OFF_SCREEN: The highlighted element scrolled out of view');
      return;
    }
    const reason = domService.notInteractableReason(element, options.index);
    if (reason) settle(reason);
  }, 200);

  let resolve: ActiveStep['resolve'] = () => {};
  let reject: ActiveStep['reject'] = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  active = { options, popup, highlight, promise, resolve, reject, clickHandler, repositionHandler, visibilityCheck };
  repositionHandler();
  return promise;
}

function takeActive(): ActiveStep | null {
  const step = active;
  active = null;
  if (!step) return null;
  if (step.clickHandler) document.removeEventListener('click', step.clickHandler, { capture: true });
  for (const event of REPOSITION_EVENTS) {
    window.removeEventListener(event, step.repositionHandler, { capture: true });
  }
  clearInterval(step.visibilityCheck);
  step.popup.remove();
  step.highlight.remove();
  return step;
}

function cleanup(): void {
  takeActive()?.reject(new ShowModeCancelled('Cancelled'));
}

function settle(failure?: string): void {
  const step = takeActive();
  if (failure) step?.reject(new Error(failure));
  else step?.resolve();
}

function trackElement(element: HTMLElement, highlight: HTMLElement, popup: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  Object.assign(highlight.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });

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

  const bestPos =
    positions.find(
      pos =>
        pos.left >= padding &&
        pos.left + POPUP_WIDTH_PX <= window.innerWidth - padding &&
        pos.top >= padding &&
        pos.top + popupHeight <= window.innerHeight - padding,
    ) ?? positions[0];

  popup.style.left = `${Math.max(padding, Math.min(bestPos.left, window.innerWidth - POPUP_WIDTH_PX - padding))}px`;
  popup.style.top = `${Math.max(padding, Math.min(bestPos.top, window.innerHeight - popupHeight - padding))}px`;
}

export const showModeService = { showToolAction, cleanup };
