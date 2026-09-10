/**
 * `useFocusTrap` tests: Escape closes the widget when focus is inside the trapped container and is
 * declined when focus is on the host page — the key belongs to the widget only while it has focus.
 */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'bun:test';
import React, { useRef } from 'react';

import { useFocusTrap } from '../useFocusTrap';

const Harness: React.FC<{ onEscape: () => void }> = ({ onEscape }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, { onEscape });
  return (
    <div>
      <button type='button' data-testid='host'>
        host page control
      </button>
      <div ref={ref}>
        <button type='button' data-testid='inside'>
          widget control
        </button>
      </div>
    </div>
  );
};

const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('the widget escape key belongs to the widget, not to the host page', () => {
  it('closes when focus is inside the trapped container', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness onEscape={onEscape} />);
    getByTestId('inside').focus();

    pressEscape();

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('declines when focus is on the host page, as the Tab arm already does', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness onEscape={onEscape} />);
    getByTestId('host').focus();

    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });
});
