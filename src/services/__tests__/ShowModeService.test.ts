/**
 * `ShowModeService` tests: a second show action cancels the one it replaced and leaves the replacement
 * live; an action the page invalidates rejects with the one reason `DomService` gave, never a second
 * contradicting code; and the click listener detached on settle leaves a stray click on the (removed)
 * target inert — it must not throw and must not resurrect a highlight or popup. A restage identical to
 * the in-flight one (same element/explanation/tool) returns the SAME pending promise rather than
 * cancelling and re-staging; `cleanup` detaches every handler it registered, not only the ones already
 * null, so a superseded show action cannot leave a stray listener on `document`/`window`; and a non-click
 * (Tell) action settles on the popup's Continue button, never on an element click.
 *
 * The restage-dedupe assertion spies on `cleanup()` rather than comparing the two calls' return values:
 * `showToolAction` is `async`, so even the dedupe branch's `return this.currentPromise` comes back
 * wrapped in a NEW promise per call, but `cleanup()` runs unconditionally past the dedupe check, so it is
 * the real signal. The handler-detach test clears the `clearInterval` spy after the first (still-null)
 * interval fires inside `showToolAction`'s own internal `cleanup()`, so only the explicit `cleanup()`
 * call against the now-live interval is being asserted. The popup fit-check table crafts each case to
 * marginally satisfy (real code) or marginally fail (a `>`/`<` mutant of the `>=`/`<=` check) exactly one
 * clause on the FIRST candidate position, with a later candidate valid at a clearly different,
 * distinguishable spot — candidate 0 is also the loop's un-matched fallback value, so a scenario where
 * every other candidate is invalid too could not otherwise tell a passing check from a failing one.
 *
 * The `../DomService` mock stubs only `getSequenceForElement`/`notInteractableReason` — the only two
 * `domService` methods `ShowModeService` itself calls — typed against the real `DomService` class via
 * `Pick<DomServiceClass, ...>` so a real signature change fails this mock at compile time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { resetDom } from '../../test/preload';
import { advanceTimersByTimeAsync, hoisted } from '../../test/vi-compat';
import type { DomService as DomServiceClass } from '../DomService';
import { ShowModeService } from '../ShowModeService';

const { notInteractableReason } = hoisted(() => ({
  notInteractableReason: vi.fn<() => string | null>(() => null),
}));

vi.mock(
  '../DomService',
  (): { domService: Pick<DomServiceClass, 'getSequenceForElement' | 'notInteractableReason'> } => ({
    domService: { getSequenceForElement: () => 0, notInteractableReason },
  }),
);

const makeShowFixture = (html: string) => {
  notInteractableReason.mockReturnValue(null);
  Element.prototype.scrollIntoView = vi.fn();
  document.body.innerHTML = html;
  return new ShowModeService();
};

const show = (service: ShowModeService, id: string) =>
  service.showToolAction({
    element: document.getElementById(id) as HTMLElement,
    explanation: id,
    browserToolName: 'click_element',
    isClickAction: true,
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
    expect(document.getElementById('marketrix-show-popup')).not.toBeNull();

    document.getElementById('b')?.click();

    expect(await second).toBe('resolved');
    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
    expect(document.getElementById('marketrix-show-popup')).toBeNull();
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
        explanation: 'Read this step',
        browserToolName: 'read_page',
        isClickAction: false,
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
