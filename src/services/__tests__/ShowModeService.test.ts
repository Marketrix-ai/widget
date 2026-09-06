import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShowModeService } from '../ShowModeService';

vi.mock('../DomService', () => ({
  domService: { getSequenceForElement: () => 0, checkElementInteractable: () => null },
}));

describe('a second show action supersedes the first', () => {
  let service: ShowModeService;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = '<button id="a"></button><button id="b"></button>';
    service = new ShowModeService();
  });

  afterEach(() => {
    service.cleanup();
    document.body.innerHTML = '';
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
