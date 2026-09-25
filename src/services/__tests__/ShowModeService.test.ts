/**
 * Tests for `ShowModeService`: staging a show action highlights and pops up over the target, a second
 * stage supersedes the first, the status popup gets its text only once it is on the page, an identical
 * restage is deduped, cleanup detaches every listener, and a page-invalidated target rejects with the
 * reason `DomService` gave.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { resetDom } from '../../test/preload';
import { advanceTimersByTimeAsync, hoisted } from '../../test/vi-compat';
import type { domService } from '../DomService';
import { showModeService } from '../ShowModeService';

type ShowModeService = typeof showModeService;

const { notInteractableReason } = hoisted(() => ({
  notInteractableReason: vi.fn<() => string | null>(() => null),
}));

vi.mock('../DomService', (): { domService: Pick<typeof domService, 'notInteractableReason'> } => ({
  domService: { notInteractableReason },
}));

const makeShowFixture = (html: string) => {
  notInteractableReason.mockReturnValue(null);
  Element.prototype.scrollIntoView = vi.fn();
  document.body.innerHTML = html;
  showModeService.cleanup();
  return showModeService;
};

const show = (service: ShowModeService, id: string) =>
  service.showToolAction({
    element: document.getElementById(id) as HTMLElement,
    index: 0,
    explanation: id,
    browserToolName: 'click_element',
  });

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const restoreGetBoundingClientRect = () => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
};

describe('a second show action supersedes the first', () => {
  let service: ShowModeService;

  beforeEach(() => {
    service = makeShowFixture('<button id="a"></button><button id="b"></button>');
  });

  afterEach(() => {
    service.cleanup();
    resetDom();
  });

  it('cancels the one it replaced and leaves the replacement live', async () => {
    const first = show(service, 'a').then(
      () => 'resolved',
      () => 'rejected',
    );
    const second = show(service, 'b').then(
      () => 'resolved',
      () => 'rejected',
    );

    expect(await first).toBe('rejected');

    expect(document.getElementById('marketrix-show-highlight')).not.toBeNull();
    expect(document.getElementById('marketrix-show-popup')).toHaveAttribute('role', 'status');

    document.getElementById('b')?.click();

    expect(await second).toBe('resolved');
    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
    expect(document.getElementById('marketrix-show-popup')).toBeNull();
  });
});

describe('the status popup is announced', () => {
  afterEach(() => {
    showModeService.cleanup();
    resetDom();
  });

  it('joins the page empty and only then receives its text, so screen readers announce the change', async () => {
    const service = makeShowFixture('<button id="a"></button>');
    const textAtAppend: Array<string | null> = [];
    const append = document.body.append.bind(document.body);
    const spy = vi.spyOn(document.body, 'append').mockImplementation((...nodes: Array<Node | string>) => {
      for (const node of nodes)
        if (node instanceof HTMLElement && node.id === 'marketrix-show-popup') textAtAppend.push(node.textContent);
      append(...nodes);
    });

    void show(service, 'a').catch(() => undefined);
    spy.mockRestore();

    expect(textAtAppend).toEqual(['']);
    expect(document.getElementById('marketrix-show-popup')?.textContent).toBe('a');
  });
});

describe('a restage identical to the one already staged', () => {
  let service: ShowModeService;

  beforeEach(() => {
    service = makeShowFixture('<button id="a"></button>');
  });

  afterEach(() => {
    service.cleanup();
    resetDom();
  });

  it('does not re-stage (re-run cleanup/createHighlight) for an identical restage while pending', async () => {
    const cleanupSpy = vi.spyOn(service, 'cleanup');
    const first = show(service, 'a').then(
      () => 'resolved',
      () => 'rejected',
    );
    const second = show(service, 'a').then(
      () => 'resolved',
      () => 'rejected',
    );
    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    document.getElementById('a')?.click();
    expect(await first).toBe('resolved');
    expect(await second).toBe('resolved');
  });
});

describe('cleanup detaches every handler it registered', () => {
  it('removes the document click listener, the window reposition listeners and the visibility interval', async () => {
    const service = makeShowFixture('<button id="a"></button>');
    const removeDocListener = vi.spyOn(document, 'removeEventListener');
    const removeWinListener = vi.spyOn(window, 'removeEventListener');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const pending = show(service, 'a').catch(() => undefined);
    clearIntervalSpy.mockClear();
    service.cleanup();
    await pending;

    expect(removeDocListener).toHaveBeenCalledWith('click', expect.any(Function), { capture: true });
    expect(removeWinListener).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    resetDom();
  });
});

describe('a non-click action settles on Continue, not on an element click', () => {
  it('resolves when the visitor presses the popup Continue button', async () => {
    const service = makeShowFixture('<button id="a"></button>');

    const settled = service
      .showToolAction({
        element: document.getElementById('a') as HTMLElement,
        index: 0,
        explanation: 'Read this step',
        browserToolName: 'type_text',
      })
      .then(
        () => 'resolved',
        () => 'rejected',
      );

    document.getElementById('a')?.click();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(document.getElementById('marketrix-show-highlight')).not.toBeNull();

    document.getElementById('marketrix-show-continue')?.click();

    expect(await settled).toBe('resolved');

    service.cleanup();
    resetDom();
  });
});

describe('the popup fit check is inclusive at every edge', () => {
  let service: ShowModeService;
  let innerWidthDescriptor: PropertyDescriptor;
  let innerHeightDescriptor: PropertyDescriptor;

  beforeEach(() => {
    innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth') as PropertyDescriptor;
    innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight') as PropertyDescriptor;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    service = makeShowFixture('<button id="a"></button>');
  });

  afterEach(() => {
    service.cleanup();
    restoreGetBoundingClientRect();
    Object.defineProperty(window, 'innerWidth', innerWidthDescriptor);
    Object.defineProperty(window, 'innerHeight', innerHeightDescriptor);
    resetDom();
  });

  it.each([
    [
      'left >= padding (right-side candidate at its low edge)',
      { left: -2000, right: -10, top: 560, bottom: 560, width: 4920, height: 0 },
      10,
      500,
    ],
    [
      'top >= padding (right-side candidate at its low edge)',
      { left: -2000, right: 480, top: 200, bottom: 300, width: 4920, height: -260 },
      500,
      10,
    ],
    [
      'left + width <= innerWidth - padding (right-side candidate at its high edge)',
      { left: -2000, right: 650, top: 560, bottom: 560, width: 4920, height: 0 },
      670,
      500,
    ],
    [
      'top + height <= innerHeight - padding (right-side candidate at its high edge)',
      { left: -2000, right: 480, top: 930, bottom: 930, width: 4920, height: 0 },
      500,
      870,
    ],
  ] as const)('%s', async (_label, rect, expectedLeft, expectedTop) => {
    Element.prototype.getBoundingClientRect = () => rect as DOMRect;

    show(service, 'a').catch(() => undefined);

    const popup = document.getElementById('marketrix-show-popup') as HTMLElement;
    expect(popup.style.left).toBe(`${expectedLeft}px`);
    expect(popup.style.top).toBe(`${expectedTop}px`);
  });
});

describe('a show action the page invalidates', () => {
  let service: ShowModeService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = makeShowFixture('<button id="a"></button>');
  });

  afterEach(() => {
    service.cleanup();
    restoreGetBoundingClientRect();
    vi.useRealTimers();
    resetDom();
  });

  it('rejects with the one reason DomService gave, not a second code contradicting it', async () => {
    const obscured = 'ELEMENT_OBSCURED: Element 0 is covered by div.modal. Dismiss it first.';
    notInteractableReason.mockReturnValue(obscured);

    const rejection = show(service, 'a').then(
      () => 'resolved',
      (error: Error) => error.message,
    );
    await advanceTimersByTimeAsync(200);

    expect(await rejection).toBe(obscured);
  });

  it('stops at off-screen without also checking interactability on the same tick', async () => {
    notInteractableReason.mockClear();
    Element.prototype.getBoundingClientRect = () => ({ bottom: -10, top: -10, right: -10, left: -10 }) as DOMRect;

    const rejection = show(service, 'a').then(
      () => 'resolved',
      (error: Error) => error.message,
    );
    await advanceTimersByTimeAsync(200);

    expect(await rejection).toBe('ELEMENT_OFF_SCREEN: The highlighted element scrolled out of view');
    expect(notInteractableReason).not.toHaveBeenCalled();
  });
});

describe('a highlight settles exactly once', () => {
  let service: ShowModeService;

  beforeEach(() => {
    service = makeShowFixture('<button id="a"></button>');
  });

  afterEach(() => {
    service.cleanup();
    resetDom();
  });

  it('a second click after the target already settled is inert, not a double resolve', async () => {
    const settled = show(service, 'a').then(
      () => 'resolved',
      () => 'rejected',
    );

    document.getElementById('a')?.click();
    expect(await settled).toBe('resolved');

    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
    expect(document.getElementById('marketrix-show-popup')).toBeNull();

    expect(() => document.getElementById('a')?.click()).not.toThrow();
    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
  });
});
