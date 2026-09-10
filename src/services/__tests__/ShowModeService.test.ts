/**
 * `ShowModeService` tests: a second show action cancels the one it replaced and leaves the replacement
 * live; an action the page invalidates rejects with the one reason `DomService` gave, never a second
 * contradicting code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDom } from '../../test/setup';
import { ShowModeService } from '../ShowModeService';

const { notInteractableReason } = vi.hoisted(() => ({
  notInteractableReason: vi.fn<() => string | null>(() => null),
}));

vi.mock('../DomService', () => ({
  domService: { getSequenceForElement: () => 0, notInteractableReason },
}));

describe('a second show action supersedes the first', () => {
  let service: ShowModeService;

  beforeEach(() => {
    notInteractableReason.mockReturnValue(null);
    Element.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = '<button id="a"></button><button id="b"></button>';
    service = new ShowModeService();
  });

  afterEach(() => {
    service.cleanup();
    resetDom();
  });

  const show = (id: string) =>
    service.showToolAction({
      element: document.getElementById(id) as HTMLElement,
      explanation: id,
      browserToolName: 'click_element',
      isClickAction: true,
    });

  it('cancels the one it replaced and leaves the replacement live', async () => {
    const first = show('a').then(
      () => 'resolved',
      () => 'rejected',
    );
    const second = show('b').then(
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
    Element.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = '<button id="a"></button>';
    service = new ShowModeService();
  });

  afterEach(() => {
    service.cleanup();
    vi.useRealTimers();
    resetDom();
  });

  it('rejects with the one reason DomService gave, not a second code contradicting it', async () => {
    const obscured = 'ELEMENT_OBSCURED: Element 0 is covered by div.modal. Dismiss it first.';
    notInteractableReason.mockReturnValue(obscured);

    const rejection = service
      .showToolAction({
        element: document.getElementById('a') as HTMLElement,
        explanation: 'a',
        browserToolName: 'click_element',
        isClickAction: true,
      })
      .then(
        () => 'resolved',
        (error: Error) => error.message,
      );
    await vi.advanceTimersByTimeAsync(200);

    expect(await rejection).toBe(obscured);
  });
});
