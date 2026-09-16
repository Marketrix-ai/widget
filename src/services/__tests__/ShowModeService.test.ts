/**
 * `ShowModeService` tests: a second show action cancels the one it replaced and leaves the replacement
 * live; an action the page invalidates rejects with the one reason `DomService` gave, never a second
 * contradicting code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { resetDom } from '../../test/preload';
import { advanceTimersByTimeAsync, hoisted } from '../../test/vi-compat';
import { ShowModeService } from '../ShowModeService';

const { notInteractableReason } = hoisted(() => ({
  notInteractableReason: vi.fn<() => string | null>(() => null),
}));

vi.mock('../DomService', () => ({
  domService: { getSequenceForElement: () => 0, notInteractableReason },
}));

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

describe('a show action the page invalidates', () => {
  let service: ShowModeService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = makeShowFixture('<button id="a"></button>');
  });

  afterEach(() => {
    service.cleanup();
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

    // The click listener is detached on settle, so a stray click on the (removed) target's id
    // must not throw and must not resurrect a highlight or popup.
    expect(() => document.getElementById('a')?.click()).not.toThrow();
    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
  });
});
