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
