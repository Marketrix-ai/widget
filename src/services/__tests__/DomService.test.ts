import { beforeEach, describe, expect, it } from 'vitest';

import { DomService } from '../DomService';

const interactable = (html: string): DomService => {
  document.body.innerHTML = html;
  const service = new DomService();
  service.getSnapshotHtml();
  return service;
};

describe('an index expires when the element behind it changes', () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 10 }) as DOMRect;
    document.elementFromPoint = () => null;
  });

  it('a rewritten href on the same node with the same id is stale', () => {
    const service = interactable('<a id="cta" href="/signup" style="position: fixed">Sign up</a>');
    expect(service.getValidatedElement(0).element).not.toBeNull();

    document.getElementById('cta')?.setAttribute('href', '/delete-account');

    expect(service.getValidatedElement(0).error).toContain('DOM_CHANGED');
  });

  it('an attribute the element gains after indexing is stale', () => {
    const service = interactable('<button style="position: fixed">Buy</button>');
    expect(service.getValidatedElement(0).element).not.toBeNull();

    document.querySelector('button')?.setAttribute('role', 'link');

    expect(service.getValidatedElement(0).error).toContain('DOM_CHANGED');
  });

  it('an untouched element stays addressable', () => {
    const service = interactable('<a id="cta" href="/signup" style="position: fixed">Sign up</a>');

    expect(service.getValidatedElement(0).element).toBe(document.getElementById('cta'));
  });
});

describe('a data-id lands on the element the index really points at', () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 10 }) as DOMRect;
    document.elementFromPoint = () => null;
  });

  it('a deeper div chain earlier in the page cannot steal a shallower element tag', () => {
    document.body.innerHTML = [
      '<div class="page" style="position: fixed">',
      '<header><div><div><div><a href="/">Home</a></div></div></div></header>',
      '<div><div><a href="/buy">Buy</a></div></div>',
      '</div>',
    ].join('');
    const service = new DomService();

    const snapshot = new DOMParser().parseFromString(service.getSnapshotHtml(), 'text/html');
    const tagged = [...snapshot.querySelectorAll('[data-id]')];

    expect(tagged).toHaveLength(2);
    for (const element of tagged) {
      const index = Number(element.getAttribute('data-id'));
      expect(service.getValidatedElement(index).element?.getAttribute('href')).toBe(element.getAttribute('href'));
    }
  });
});
