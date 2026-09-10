/**
 * `DomService` tests: an index expires when the element behind it changes (a rewritten href, a gained
 * attribute) while an untouched one stays addressable; a `data-id` lands on the element the index really
 * points at; the widget's own shadow host is exempt from obstruction (it is what `elementFromPoint`
 * reports for any hit on the widget) while a host overlay still obscures; and a disabled or
 * aria-disabled control is refused at act time rather than hidden from the index.
 */
import { beforeEach, describe, expect, it } from 'bun:test';

import { DomService } from '../DomService';

const interactable = (html: string): DomService => {
  document.body.innerHTML = html;
  const service = new DomService();
  service.reindexAndSnapshot();
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

    const snapshot = new DOMParser().parseFromString(service.reindexAndSnapshot(), 'text/html');
    const tagged = [...snapshot.querySelectorAll('[data-id]')];

    expect(tagged).toHaveLength(2);
    for (const element of tagged) {
      const index = Number(element.getAttribute('data-id'));
      expect(service.getValidatedElement(index).element?.getAttribute('href')).toBe(element.getAttribute('href'));
    }
  });
});

describe('the widget covering a target is not an obstacle the agent can clear', () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 10 }) as DOMRect;
  });

  it('exempts the shadow host, which is what elementFromPoint reports for any hit on the widget', () => {
    const service = interactable(
      '<button style="position: fixed">Buy</button><div class="marketrix-widget-container"></div>',
    );
    document.elementFromPoint = () => document.querySelector('.marketrix-widget-container');

    expect(service.getValidatedElement(0).error).toBeUndefined();
  });

  it('still reports a host-page overlay as obscuring', () => {
    const service = interactable('<button style="position: fixed">Buy</button><div class="cookie-banner"></div>');
    document.elementFromPoint = () => document.querySelector('.cookie-banner');

    expect(service.getValidatedElement(0).error).toContain('ELEMENT_OBSCURED');
  });
});

describe('a control the visitor could not operate is refused at act time, not hidden from the index', () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 10 }) as DOMRect;
    document.elementFromPoint = () => null;
  });

  it('refuses a disabled button, whose click() would have fired no handler', () => {
    const service = interactable('<button disabled style="position: fixed">Submit</button>');

    expect(service.getValidatedElement(0).error).toContain('is a disabled control');
  });

  it('refuses an aria-disabled widget the same way as a native disabled one', () => {
    const service = interactable('<div role="button" aria-disabled="true" style="position: fixed">Submit</div>');

    expect(service.getValidatedElement(0).error).toContain('is aria-disabled');
  });

  it('refuses anything inside an inert subtree', () => {
    const service = interactable('<div inert style="position: fixed"><button>Submit</button></div>');

    expect(service.getValidatedElement(0).error).toContain('is inside an inert subtree');
  });

  it('still indexes the disabled control, so the agent can see what it may not click', () => {
    const service = interactable('<button disabled style="position: fixed">Submit</button>');

    expect(service.reindexAndSnapshot()).toContain('data-id="0"');
  });
});
